Chats = new Mongo.Collection("chats");

if (Meteor.isClient) {

    // Add username field to sign up form
    Accounts.ui.config({
        passwordSignupFields: 'USERNAME_AND_EMAIL'
    });

    Meteor.subscribe('users');
    //Meteor.subscribe('chats');

    // set up the main template the the router will use to build pages
    Router.configure({
        layoutTemplate: 'ApplicationLayout'
    });
    // specify the top level route, the page users see when they arrive at the site
    Router.route('/', function () {
        console.log("rendering root /");
        this.render("navbar", {to: "header"});
        this.render("lobby_page", {to: "main"});
    });

    // specify a route that allows the current user to chat to another users
    Router.route('/chat/:_id', function () {
        // the user they want to chat to has id equal to
        // the id sent in after /chat/...
        var otherUserId = this.params._id;

        //Wait till the data from server has been received
        this.wait(Meteor.subscribe('chats', Meteor.userId(), otherUserId));
        // find a chat that has two users that match current user id
        // and the requested user id
        var filter = {
            $or: [
                {user1Id: Meteor.userId(), user2Id: otherUserId},
                {user1Id: otherUserId, user2Id: Meteor.userId()}
            ]
        };
        var chat = Chats.findOne(filter), chatId;

        if (this.ready()) {
            if (!chat) {// no chat matching the filter - need to insert a new one
                console.log('creating new chat');
                var newChat = {user1Id: Meteor.userId(), user2Id: otherUserId};
                chatId = Meteor.call('createChat', newChat, function (error, result) {
                    chatId = result;
                });

            }
            else {// there is a chat going already - use that.
                chatId = chat._id;
            }
            if (chatId) {// looking good, save the id to the session
                Session.set("chatId", chatId);
            }
        }
        this.render("navbar", {to: "header"});
        this.render("chat_page", {to: "main"});
    });

    ///
    // helper functions
    ///
    Template.available_user_list.helpers({
        users: function () {
            return Meteor.users.find();
        }
    });
    Template.available_user.helpers({
        getUsername: function (userId) {
            var user = Meteor.users.findOne({_id: userId});
            return user.profile.username;
        },
        isMyUser: function (userId) {
            return userId == Meteor.userId();

        }
    });

    Template.chat_message.helpers({
        getUser: function (msg) {
            var id = msg.author;
            if (id) {
                var user = Meteor.users.findOne({_id: id});
                return user.profile;
            }

        },

        isMyUser: function (msg) {
            return msg.author == Meteor.userId();
        }
    });


    Template.chat_page.helpers({
        messages: function () {
            var chat = Chats.findOne({_id: Session.get("chatId")});
            if (chat)
                return chat.messages;
        },

        other_user: function () {
            return ""
        }

    });


    // Events
    Template.chat_page.events({
        // this event fires when the user sends a message on the chat page
        'submit .js-send-chat': function (event) {
            // stop the form from triggering a page reload
            event.preventDefault();
            // see if we can find a chat object in the database
            // to which we'll add the message
            var chat = Chats.findOne({_id: Session.get("chatId")});
            if (chat) {// ok - we have a chat to use
                var msgs = chat.messages; // pull the messages property
                if (!msgs) {// no messages yet, create a new array
                    msgs = [];
                }
                // is a good idea to insert data straight from the form
                // (i.e. the user) into the database?? certainly not.
                // push adds the message to the end of the array
                msgs.push({author: Meteor.userId(), text: event.target.chat.value});
                // reset the form
                event.target.chat.value = "";
                // put the messages array onto the chat object
                chat.messages = msgs;
                // update the chat object in the database.
                Meteor.call('addMessage', chat._id, chat);

            }
        }
    })
}


// start up script that creates some users for testing
// users have the username 'user1@test.com' .. 'user8@test.com'
// and the password test123 

if (Meteor.isServer) {
    Meteor.startup(function () {
        if (!Meteor.users.findOne()) {
            for (var i = 1; i < 9; i++) {
                var email = "user" + i + "@test.com";
                var username = "user" + i;
                var avatar = "ava" + i + ".png";
                console.log("creating a user with password 'test123' and username/ email: " + email);
                Meteor.users.insert({
                    profile: {username: username, avatar: avatar},
                    emails: [{address: email}],
                    services: {password: {"bcrypt": "$2a$10$I3erQ084OiyILTv8ybtQ4ON6wusgPbMZ6.P33zzSDei.BbDL.Q4EO"}}
                });
            }
        }
    });

    Accounts.onCreateUser(function (options, user) {
        // Use provided profile in options, or create an empty object
        user.profile = options.profile || {};
        // Assigns first and last names to the newly created user object
        user.profile.username = options.username;
        user.profile.avatar = 'ava1.png';
        // Returns the user object
        return user;
    });
    Meteor.publish("users", function () {
        return Meteor.users.find();
    });

    Meteor.publish("chats", function (id1, id2) {
        var filter = {
            $or: [
                {user1Id: id1, user2Id: id2},
                {user1Id: id2, user2Id: id1}
            ]
        };
        return Chats.find(filter);
    });

    Meteor.methods({
        createChat: function (chat) {
            return Chats.insert({user1Id: chat.user1Id, user2Id: chat.user2Id});
        },

        addMessage: function (id, chat) {
            Chats.update(id, chat);
        }
    });
}
