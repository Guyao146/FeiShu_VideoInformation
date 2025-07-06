const PLATFORM_APIS = {
  // ... existing platforms ...
  xiaohongshu: {
    baseUrl: 'https://open.xiaohongshu.com/api',
    oauthPath: '/oauth/access_token',
    dataPath: '/data/videos',
    authType: 'client_credentials'
  }
};

// 实现小红书数据获取
async function fetchPlatformData(platform) {
  if (platform === 'xiaohongshu') {
    const config = PLATFORM_APIS[platform];
    
    // 获取Access Token
    const authResponse = await axios.post(
      `${config.baseUrl}${config.oauthPath}`,
      `client_id=${process.env.XHS_CLIENT_ID}&client_secret=${process.env.XHS_CLIENT_SECRET}&grant_type=${config.authType}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // 获取视频数据
    const dataResponse = await axios.get(`${config.baseUrl}${config.dataPath}`, {
      headers: {
        Authorization: `Bearer ${authResponse.data.access_token}`
      },
      params: {
        start_date: moment().subtract(1, 'days').format('YYYY-MM-DD'),
        end_date: moment().format('YYYY-MM-DD')
      }
    });

    // 数据标准化
    return {
      platform: '小红书',
      date: moment().format('YYYY-MM-DD'),
      video_views: dataResponse.data.total_views,
      likes: dataResponse.data.total_likes,
      shares: dataResponse.data.total_shares
    };
  }
}

async function updateFeishuDoc(data) {
  // 获取表格现有字段
  const tableInfo = await client.bitable.appTable.get({
    app_token: process.env.APP_TOKEN,
    table_id: process.env.TABLE_ID
  });
  
  // 提取现有字段名称
  const existingFields = new Set(tableInfo.data.fields.map(f => f.field_name));

  // 确定必要字段
  const requiredFields = ['平台', '发布时间', '播放量', '点赞量', '分享量', '粉丝数'];
  
  // 创建缺失字段
  for (const field of requiredFields) {
    if (!existingFields.has(field)) {
      await client.bitable.appTableField.create({
        app_token: process.env.APP_TOKEN,
        table_id: process.env.TABLE_ID,
        data: {
          field_name: field,
          type: 1 // 1表示文本类型
        }
      });
      console.log(`已创建新字段: ${field}`);
    }
  }

  // 创建多维表格行
  const resp = await client.bitable.appTableRecord.batchCreate({
    app_token: process.env.APP_TOKEN,
    table_id: process.env.TABLE_ID,
    data: {
      records: data.map(item => ({
        fields: {
          "平台": item.platform,
          "日期": item.date,
          "播放量": item.video_views,
          "点赞量": item.likes,
          "分享量": item.shares
        }
      }))
    }
  });
  
  if (resp.code !== 0) {
    throw new Error('飞书文档更新失败: ' + resp.msg);
  }
  console.log('数据更新成功:', resp.data.records.length, '条');
}