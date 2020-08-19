const discord = require('discord.js');
const youtube = require('ytdl-core');

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
    else {
        message.channel.send("Please write a valid command!")
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
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return (message.send("You need to be in a voice channel to play music!"));

    const user = message.member;
    if (!user.hasPermission("CONNECT") || !user.hasPermission("SPEAK"))
        return (message.send("I need the permissions to join and speak in your voice channel!"));

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
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end()
};

client.login('<YOUR-TOKEN>');