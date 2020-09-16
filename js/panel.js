const statusText = document.getElementById('status');
const loginStatusText = document.getElementById('loginStatus');
const projectStatusText = document.getElementById('projectStatus');

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const currentUrl = new URL(tabs[0].url);
  if (currentUrl.host !== 'www.freelancer.com') {
    statusText.innerHTML = 'Connection failed! Current site is not freelancer.com';
    statusText.className = 'error';
    return;
  }

  statusText.innerHTML = 'Connection success! Current site is freelancer.com';
  statusText.className = 'success';

  let wssUrl;
  chrome.devtools.network.onRequestFinished.addListener(function(request) {
    if (request.request.url.startsWith('wss://')) {
      wssUrl = request.request.url;
      const dataToSend = request._webSocketMessages.filter(x => x.type === 'send').map(x => x.data);
      listenToWebSocketConnection(wssUrl, dataToSend);
    }
  });

  setTimeout(function() {
    if (!wssUrl) {
      loginStatusText.innerText = 'Could not connect to dashboard. Please ensure you are logged in and reload the page';
      loginStatusText.className = 'error';
    }
  }, 5000);
});

function listenToWebSocketConnection (url, dataToSend) {
  if('WebSocket' in window) {
    const websocket = new WebSocket(url);

    websocket.onopen = function() {
      loginStatusText.innerText = 'Connection established successfully! You should receive notification of new projects';
      loginStatusText.className = 'success';
    };

    websocket.onerror = function(err) {
      loginStatusText.innerText = 'Failed to connect. Please reload the page';
      loginStatusText.className = 'error';
    };

    websocket.onmessage = function (event) {
      if (event.data === 'o') {
        for (const data of dataToSend) {
          websocket.send(data);
        }
      } else if (event.data.substr(0, 1) === 'c' && event.data.split('"')[1] === 'Expected auth request for session before timeout') {
        loginStatusText.innerText = 'Failed to connect. Please reload the page';
        loginStatusText.className = 'error';
      }
      else if (event.data.substr(0, 1) === 'a') {
        const data = JSON.parse(event.data.substring(3, event.data.length - 2).replace(/\\"/g, '"'));
        if (data.body.type === 'project' || data.body.type === 'failingProject') {
          const project = data.body.data;
          sendNotification(
            project.title, 
            `${project.appended_descr} - ${project.currency}${project.minbudget} to ${project.currency}${project.maxbudget}`,
            `https://freelancer.com${project.linkUrl}`
          ).then(() => {
            projectStatusText.innerHTML += `Sent notification for project: ${project.title} <br>`;
          });
        }
      }
    };

    websocket.onclose = function() {
      loginStatusText.innerText = 'Connection closed. Please reload the page';
      loginStatusText.className = 'error';
    };

  } else {
    loginStatusText.innerText = 'Your browser is not supported. Please upgrade your browser';
    loginStatusText.className = 'error';
  }
}

async function sendNotification(title, body, url) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted" && await Notification.requestPermission() !== "granted") {
    return;
  }
  
  var notification = new Notification(title, {
    body: `${body} | ${url}`
  });
  notification.onclick = function(event) {
    window.open(url);
  };
}