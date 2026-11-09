const form = document.querySelector('form');
const file = document.querySelector('#file');
const url = document.querySelector('#url');
const status = document.querySelector('#status');
const button = document.querySelector('button');

const results = {
  verified_suno: ['Suno credentials verified','Suno verified its Content Credentials for the submitted media.'],
  no_suno_provenance: ['No Suno credentials found','The detector found no verifiable Suno provenance in the submitted media.'],
  inconclusive: ['Inconclusive','Suno could not make a determination from the submitted media.']
};

function show(title, message) {
  const heading = document.createElement('h2');
  const detail = document.createElement('p');
  heading.textContent = title;
  detail.textContent = message;
  status.replaceChildren(heading, detail);
}

function syncSource() {
  const useUrl = form.elements.source.value === 'url';
  file.disabled = useUrl;
  url.disabled = !useUrl;
  document.querySelector('#file-field').hidden = useUrl;
  document.querySelector('#url-field').hidden = !useUrl;
}

form.addEventListener('change', event => {
  if (event.target.name === 'source') syncSource();
});
syncSource();

form.addEventListener('submit', async event => {
  event.preventDefault();
  const useUrl = form.elements.source.value === 'url';
  const audio = file.files[0];
  if (!useUrl && (!audio?.size || audio.size > 99_000_000)) {
    show('Check the file','Choose a nonempty audio file up to 99 MB.');
    return;
  }
  const headers = {'X-Provenance-Request':'1'};
  if (useUrl) headers['Content-Type'] = 'application/json';
  else headers['X-Audio-Extension'] = audio.name.split('.').pop().toLowerCase();
  button.disabled = true;
  show('Checking provenance','Waiting for Suno’s detector.');
  try {
    const response = await fetch(useUrl ? '/api/check/url' : '/api/check/file', {
      method:'POST', headers, body:useUrl ? JSON.stringify({url:url.value.trim()}) : audio
    });
    const data = await response.json();
    if (!response.ok) {
      show('Check unavailable',data.error);
      return;
    }
    show(...results[data.verdict]);
  } catch {
    show('Check unavailable','The request could not be completed. Try again shortly.');
  } finally {
    button.disabled = false;
  }
});
