const fs = require('fs');
const https = require('https');

const key = 'AIzaSyDqtwHSbwyc2ebbW7247DizWugh0crqpfU';
const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=' + key;

const body = JSON.stringify({
  contents: [{ parts: [{ text: 'Design a premium iOS app icon using a single abstract glass symbol. Concept: An elegant minimalist cooking symbol with a hidden smile. The shape is one continuous smooth form that subtly forms a smiling curve in the lower part, evoking happiness, warmth, and enjoyment of food. The smile should be minimal and clever — visible only after a moment of observation. Style: Liquid Glass / Glassmorphism inspired by Apple iOS 26 and visionOS. The symbol looks like frosted translucent glass with soft refraction and depth. Very clean, modern, and premium. Glass material details: Semi-transparent frosted glass fill, soft internal light diffusion, subtle inner glow, thin white highlight along e top edge, gentle soft shadow beneath the object, feels like a real glass object resting on the surface. Background: Very subtle light gradient mesh with warm neutral tones: soft cream, light peach, warm gray. Background must stay minimal and quiet to emphasize the glass object. Composition: Square 1024x1024 iOS app icon with smooth rounded corners. Single centered symbol with generous padding. No text, no letters, no logos, no patterns. Mood: Premium, friendly, calm, joyful. Feels native to iOS 26 home screen. Not flat, not cartoon, not skeuomorphic — pure modern glass design.' }] }],
  generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
});

const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const parts = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
    const img = parts.find(p => p.inlineData);
    if (img) {
      fs.writeFileSync('app-icon.png', Buffer.from(img.inlineData.data, 'base64'));
      console.log('Icon saved to app-icon.png');
    } else {
      console.log('No image generated. Response:', JSON.stringify(json, null, 2));
    }
  });
});
req.write(body);
req.end();
