const https = require('https');
const key = 'AIzaSyDqtwHSbwyc2ebbW7247DizWugh0crqpfU';
const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + key;
https.get(url, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const models = json.models || [];
    models.forEach(m => {
      console.log(m.name, '-', (m.supportedGenerationMethods || []).join(', '));
    });
  });
});
