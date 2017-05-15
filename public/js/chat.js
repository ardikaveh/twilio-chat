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
    $('.startChat').on('click', function(){
      startChat($('.defaultThem').val());
      $('.message').val('');
    });

    $('.sendchat').on('click', function(){
      sendMessage($('.message').val());
      $('.message').val('');
    });

    $('.activeChats').on('click', '.channel', function(e){
      setActiveChannel(e.target.id);
    });
      
    

    ///////render

    function renderConnectionStatus(){
      var connectionInfo = $('.connectionStatus');
      connectionInfo.html(chatClient.connectionState);
      chatClient.on('connectionStateChanged', function(state) {
        connectionInfo.html(chatClient.connectionState);
      });
    }

    function renderMessages(messages){
      $('.messageBox').html('');
      messages.items.forEach(function(message){
        renderMessage(message);
      });
    }


    function renderMessage(message){
      $('.messageBox').append('<span>'+ message.author + ':</span>' + '<span>'+ message.body + '<br/></span>');
      var height = $('.messageBox')[0].scrollHeight;
      $('.messageBox').scrollTop(height);
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
        var $activeChats = $('.activeChats');
        $activeChats.html('');
        channels.sort(sortByLastMessageTime);
        for (i=0; i<channels.length; i++) {
          var channel = channels[i];
          $activeChats.append('<li><button class="channel" id="'+ channel.sid +'">'+ chattingWithName(channel) +'</button></li>');
          if(!activeChannel && i == 0){
            setActiveChannel(channel.sid);
          }
        }
      });
    }

    function renderChatStatus(){
      $('.chatInfo').html('activeChannel: ' + chattingWithName(activeChannel) + '<br>');
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