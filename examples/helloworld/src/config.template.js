export default {
  janode: [{
    server_key: 'janus_1_api',
    address: [{
      url: 'ws://127.0.0.1:8188/',
      apisecret: 'secret',
      token: 'janustoken'
    }],
    // seconds between retries after a connection setup error
    retry_time_secs: 10
  },
  {
    server_key: 'janus_1_admin',
    is_admin: true,
    address: [{
      // wrong for testing
      url: 'ws://127.0.0.1:7777/',
      apisecret: 'janusoverlord'
    },
    {
      url: 'ws://127.0.0.1:7188/',
      apisecret: 'janusoverlord'
    }],
    // seconds between retries after a connection setup error
    retry_time_secs: 10
  }]
};
