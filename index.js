const discord = require('discord.js');
const youtube = require('ytdl-core');
const config = require('./config.json');

const client = new discord.Client();
const queue = new Map();

client.once('ready', () => {
    console.log('Ready!');
});
client.once('reconnecting', () => {
    console.log('Reconnecting!');
});
client.once('disconnect', () => {
    console.log('Disconnect!');
});

client.on('message', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const serverQueue = queue.get(message.guild.id);
    if (message.content.startsWith('!play')) {
        execute(message, serverQueue);
        return;
    }
    else if (message.content.startsWith('!skip')) {
        skip(message, serverQueue);
        return;
    }
    else if (message.content.startsWith('!stop')) {
        stop(message, serverQueue);
        return;
    }
    else if (message.content.startsWith('!queue')) {
        queueList(message, serverQueue);
        return;
    }
    else if (message.content.startsWith('!dmb')) {
        help(message);
        return;
    }
});

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voice.leave();
        queue.delete(guild.id);
        return;
    }
    const channel = serverQueue.connection
    .play(youtube(song.url))
        .on("finish", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", (error) => console.log(error));

    channel.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.channel.send(`Start playing: ${song.title}`);
}

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    if (!args || !args[1])
        return (message.channel.send("You didn't put an url, so I can't find your music!"));
    
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return (message.channel.send("You need to be in a voice channel to play music!"));

    const user = message.member;
    if (!user.hasPermission("CONNECT") || !user.hasPermission("SPEAK"))
        return (message.channel.send("I need the permissions to join and speak in your voice channel!"));

    const songInfo = await youtube.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url
    }
    if (!serverQueue) {
        const queueContruct = {
            channel: message.channel,
            voice: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        
        queue.set(message.guild.id, queueContruct);
        queueContruct.songs.push(song);

        try {
            queueContruct.connection = await voiceChannel.join();
            play(message.guild, queueContruct.songs[0]);
        }
        catch(error) {
            console.log(error);
            queue.delete(message.guild.id);
            return;
        }
    }
    else {
        serverQueue.songs.push(song);
        return (message.channel.send(`${song.title} has been added to the queue!`));
    }
};

async function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return (message.channel.send("You have to be in a voice channel to stop the music!"));
    if (!serverQueue)
        return (message.channel.send("There is no song that I could skip!"));
    serverQueue.connection.dispatcher.end();
};

async function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("You have to be in a voice channel to stop the music!");
    if (!serverQueue || !serverQueue.songs)
        return (message.channel.send("There is no song that I could stop!"));
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end()
};

function queueList(message, serverQueue) {
    if (!serverQueue || !serverQueue.songs)
        return (message.channel.send("There's no sound in the queue!"));
    var queueList = [];
    for (var i = 0; i < serverQueue.songs.length; i++) {
        queueList.push({
            name: serverQueue.songs[i].title,
            value: serverQueue.songs[i].url
        });
    };

    const queueEmbed = new discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Queue list')
        .addFields(queueList)
        .setTimestamp()
    message.channel.send(queueEmbed);
}

function help(message) {
    const helpEmbed = new discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('Help')
        .addFields(
            {name: '!play <YOUR-URL>', value: 'Play your song or add to queue.'},
            {name: '!stop', value: 'Stop the current song.'},
            {name: '!skip', value: 'Skip to the next song or if it doesn\'t exist just stop it.'},
            {name: '!queue', value: 'Displays the list of songs in the waiting list.'},
        )
        .setTimestamp()
    message.channel.send(helpEmbed);
}

client.login(config.token);