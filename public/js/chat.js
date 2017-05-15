(function(){
  $(function() {

    var fingerprint = new Fingerprint2();
    var me = urlParam('email');
    var activeChannel = null;
    var channels = {};
    var chatClient = {};

    if(!me) return;
    $('.me').val(me);
    document.title = me;

    fingerprint.get(function(endpointId) {
      getToken(me, endpointId).done(function(token){

        // accessManager = new Twilio.AccessManager(token);
        // accessManager.on('tokenUpdated', am => client.updateToken(am.token));
        chatClient = new Twilio.Chat.Client(token, { logLevel: 'debug' });
        chatClient.initialize().then(() => {
          renderChannels();
          renderConnectionStatus();

          $('.loading').hide();
          $('.channel, .channels').show();

          //////twilio events
          chatClient.on('channelAdded', renderChannels);
          chatClient.on('channelJoined', function(channel) {
            //channel.on('messageAdded', updateUnreadMessages);
            if(!channel._events["messageAdded"].length){
              channel.on('messageAdded', recieveMessage);
            }
          });
        });
      });
    });


    //////ui events
    $('.start-chat').on('click', function(){
      startChat($('.default-them').val());
    });

    $('.message-input').on('keypress', function(e){
      if(e.keyCode === 13){
        e.preventDefault();
        $('.send-chat').trigger('click');
      }
    });

    $('.send-chat').on('click', function(){
      var $messageInput = $('.message-input');
      if($messageInput) {
        sendMessage($messageInput.val());
        $messageInput.val('');
      }

    });

    $('.active-chats').on('click', '.join-channel', function(e){
      setActiveChannel(e.target.id);
    });



    ///////render

    function renderConnectionStatus(){
      var connectionInfo = $('.connection-status');
      connectionInfo.html('status: ' + chatClient.connectionState);
      chatClient.on('connectionStateChanged', function(state) {
        connectionInfo.html('status: ' + chatClient.connectionState);
      });
    }

    function renderMessages(messages){
      $('.message-box').html('');
      messages.items.forEach(function(message){
        renderMessage(message);
      });
    }


    function renderMessage(message){
      var messageClass = message.author == me ? 'me' : 'them';
      $('.message-box').append('<div class="message ' + messageClass + '"><span>'+ message.body + '</span></div>');
      var height = $('.message-box')[0].scrollHeight;
      $('.message-box').scrollTop(height);
    }

    function renderChannel(){
      if(activeChannel.status != 'joined'){
        activeChannel.join().then(function(channel){
          activeChannel = channel;
          activeChannel.getMessages().then(function(messages){
            renderMessages(messages)
          });
        });
      }
      else {
        activeChannel.getMessages().then(function(messages){
          renderMessages(messages)
        });
      }

    }

    function renderChannels(){
      chatClient.getSubscribedChannels().then(function(paginator){
        channels = paginator.items;
        if(channels.length){
          var $activeChats = $('.active-chats');
          $activeChats.html('');
          channels.sort(sortByLastMessageTime);
          for (i=0; i<channels.length; i++) {
            var channel = channels[i];
            $activeChats.append('<li><button class="join-channel" id="'+ channel.sid +'">'+ chattingWithName(channel) +'</button></li>');
            if(!activeChannel && i == 0){
              setActiveChannel(channel.sid);
            }
          }
        }
      });
    }

    function renderChatStatus(){
      $('.chat-info').html(chattingWithName(activeChannel));
    }

    function recieveMessage(message){
      renderChannels();
      if(activeChannel.sid == message.channel.sid){
        renderMessage(message);
      }
    }




    //////helpers

    function startChat(userName){
      if(userName == me)
        return;
      chatClient.getUser(userName).then(function(user){
        //create channel, join it, add other user
        createChannel(userName).then(function(channel){
          channel.join().then(function(channel){
            activeChannel = channel;
            channel.add(userName);
            setActiveChannel(activeChannel.sid)
          });
        });
      });
    }

    function chattingWithName(channel){
      return channel.createdBy != me ? channel.createdBy : channel.friendlyName;
    }

    function setActiveChannel(channelId){
      activeChannel = channels.find(function(channel){ return channel.sid === channelId; })
      renderChatStatus();
      renderChannel();
    }

    function sendMessage(message){
      if(activeChannel) {
        activeChannel.sendMessage(message, {});
        activeChannel.updateAttributes({lastMessageTime : Date.now()}).then(function(){
          renderChannels();
        });
      }
      else {
        console.log('should never be sending in a non active channel');
      }
    }

    function createChannel(userName) {
      return chatClient.createChannel({
          uniqueName: uniqueChannelName(userName),
          friendlyName: userName,
          isPrivate: true
        });
    }

    function uniqueChannelName(them){
      var uniqueChannelName = me.localeCompare(them) == -1 ? me + them : them + me;
      return uniqueChannelName;
    }

    function getToken(userEmail, endpointId) {
      return $.get('getToken?identity=' + userEmail + '&endpointId=' + endpointId);
    }


    function urlParam (name) {
      var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
      return (results && results[1]) || 0;
    }

    function sortByLastMessageTime(a, b){
      var aTime = a.attributes.lastMessageTime || 0;
      var bTime = b.attributes.lastMessageTime || 0;
      return ((aTime > bTime) ? -1 : ((aTime < bTime) ? 1 : 0));
    }


  });
})();