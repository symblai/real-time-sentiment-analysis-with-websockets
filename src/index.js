var getAuthentication = async function() {

}

var openSocket = async function() {
  // const fetchData = {
  //   method: "POST",
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     'type': 'application',
  //     'appId': '',
  //     'appSecret': '',
  //   })
  // }
  // const res = await fetch("https://api.symbl.ai/oauth2/token:generate", fetchData);
  // const json = await res.json();
  /**
   * The JWT token you get after authenticating with our API.
   * Check the Authentication section of the documentation for more details.
   */
  // const accessToken = json.accessToken;

  const accessToken = "";
  const uniqueMeetingId = btoa("devrelations@symbl.ai");
  const symblEndpoint = `wss://api.symbl.ai/v1/realtime/insights/${uniqueMeetingId}?access_token=${accessToken}`;
  const ws = new WebSocket(symblEndpoint);
  var conversationId;
  let cacheTable = [];
  // Fired when a message is received from the WebSocket server
  ws.onmessage = async (event) => {
    // You can find the conversationId in event.message.data.conversationId;
    const data = JSON.parse(event.data);
    if (data.type === 'message' && data.message.hasOwnProperty('data')) {
      console.log('conversationId', data.message.data.conversationId);
      conversationId = data.message.data.conversationId;
      console.log('onmessage event', event);
    }
    if (data.type === 'message_response') {
      for (let message of data.messages) {
        console.log('Transcript (more accurate): ', message.payload.content);
      }
      if (conversationId) {
        // You can log sentiments on messages from data.message.data.conversationId
        const sentimentEndpoint = `https://api.symbl.ai/v1/conversations/${conversationId}/messages?sentiment=true`;
        const response = await fetch(sentimentEndpoint, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        const resp = await response.json();
        if (response.ok) {
          let rows = "";

          for (let message of resp.messages) {
            if (cacheTable.indexOf(message.id) === -1) {
              console.log('Polarity: ', message.sentiment.polarity.score);
            }
            rows += `
              <tr>
                <td>${message.id}</td>
                <td>${message.sentiment.polarity.score}</td>
              </tr>
            `
            cacheTable.push(message.id);
          }

          let tableHtml = `
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Polarity</th>
                </tr>
              </thead>
              <tbody>
              ${rows}
              </tbody>
            </table>
          `;

          debugger;

          document.querySelector("#table-parent").innerHTML = tableHtml;

        }
      }
    }
    if (data.type === 'topic_response') {
      for (let topic of data.topics) {
        console.log('Topic detected: ', topic.phrases)
      }
    }
    if (data.type === 'insight_response') {
      for (let insight of data.insights) {
        console.log('Insight detected: ', insight.payload.content);
      }
    }
    if (data.type === 'message' && data.message.hasOwnProperty('punctuated')) {
      console.log('Live transcript: ', data.message.punctuated.transcript);
    }
    // console.log(`Response type: ${data.type}. Object: `, data);
  };
  // Fired when the WebSocket closes unexpectedly due to an error or lost connetion
  ws.onerror  = (err) => {
    console.error(err);
  };
  // Fired when the WebSocket connection has been closed
  ws.onclose = (event) => {
    console.info('Connection to websocket closed');
  };
  // Fired when the connection succeeds.
  ws.onopen = (event) => {
    ws.send(JSON.stringify({
      type: 'start_request',
      meetingTitle: 'Websockets How-to', // Conversation name
      insightTypes: ['question', 'action_item'], // Will enable insight generation
      config: {
        confidenceThreshold: 0.5,
        languageCode: 'en-US',
        speechRecognition: {
          encoding: 'LINEAR16',
          sampleRateHertz: 44100,
        }
      },
      speaker: {
        userId: 'example@symbl.ai',
        name: 'Example Sample',
      }
    }));
  };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  /**
   * The callback function which fires after a user gives the browser permission to use
   * the computer's microphone. Starts a recording session which sends the audio stream to
   * the WebSocket endpoint for processing.
   */
  const handleSuccess = (stream) => {
    const AudioContext = window.AudioContext;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(1024, 1, 1);
    const gainNode = context.createGain();
    source.connect(gainNode);
    gainNode.connect(processor);
    processor.connect(context.destination);
    processor.onaudioprocess = (e) => {
      // convert to 16-bit payload
      const inputData = e.inputBuffer.getChannelData(0) || new Float32Array(this.bufferSize);
      const targetBuffer = new Int16Array(inputData.length);
      for (let index = inputData.length; index > 0; index--) {
          targetBuffer[index] = 32767 * Math.min(1, inputData[index]);
      }
      // Send audio stream to websocket.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(targetBuffer.buffer);
      }
    };
  };
  handleSuccess(stream);
}
