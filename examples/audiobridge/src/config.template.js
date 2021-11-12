module.exports = {

  janode: {
    address: [{
      url: 'ws://127.0.0.1:8188/',
      apisecret: 'secret'
    }],
    // seconds between retries after a connection setup error
    retry_time_secs: 10
  },

  web: {
    port: 4443,
    bind: '0.0.0.0',
    key: __dirname + '/../../../key.pem',
    cert: __dirname + '/../../../cert.pem'
  }
};