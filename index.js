const Discord = require("discord.js");
const config = require("./config");

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});

const settings = {
    prefix: '%',
    token: config.token
};

const {Player, RepeatMode} = require("discord-music-player");

const player = new Player(client, {
    leaveOnEnd: false,
    leaveOnStop: true,
    leaveOnEmpty: false,
    deafenOnJoin: false,
    volume: 100,
    quality: 'high'
});

client.player = player;

let songData = [];
const playerAction = async () => {
    const {RepeatMode} = require('discord-music-player');

    client.on('messageCreate', async (message) => {
        const args = message.content.slice(settings.prefix.length).trim().split(/ +/g);
        const command = args.shift();
        let guildQueue = client.player.getQueue(message.guild.id);

        if (!message.member || !message.guild) {
            return;
        }

        const Guild = client.guilds.cache.get(message.guild.id); // Getting the guild.
        const Member = Guild.members.cache.get(message.member.id); // Getting the member.

        if (command === 'play') {
            if (!Member.voice.channel) {
                await message.reply("You are not in a voice channel!");

                return;
            }

            let queue = client.player.createQueue(message.guild.id);

            await queue.join(message.member.voice.channel);

            let song = await queue.play(args.join(' ')).catch(err => {
                console.log(err);
                if (!guildQueue)
                    queue.stop();
            });

            songData.push({
                guildObject: Guild,
                memberObject: Member,
                guild: message.guild.id,
                channel: message.channel.id,
                songData: song
            });
        }

        if (command === 'playlist') {
            let queue = client.player.createQueue(message.guild.id);
            await queue.join(message.member.voice.channel);
            let song = await queue.playlist(args.join(' ')).catch(err => {
                console.log(err);
                if (!guildQueue)
                    queue.stop();
            });
        }

        if (command === 'skip') {
            if (!Member.voice.channel) {
                await message.reply("You are not in a voice channel!");

                return;
            }

            guildQueue.skip();
        }

        if (command === 'stop') {
            guildQueue.stop();
        }

        if (command === 'removeLoop') {
            guildQueue.setRepeatMode(RepeatMode.DISABLED); // or 0 instead of RepeatMode.DISABLED
        }

        if (command === 'toggleLoop') {
            guildQueue.setRepeatMode(RepeatMode.SONG); // or 1 instead of RepeatMode.SONG
        }

        if (command === 'toggleQueueLoop') {
            guildQueue.setRepeatMode(RepeatMode.QUEUE); // or 2 instead of RepeatMode.QUEUE
        }

        if (command === 'setVolume') {
            guildQueue.setVolume(parseInt(args[0]));
        }

        if (command === 'seek') {
            guildQueue.seek(parseInt(args[0]) * 1000);
        }

        if (command === 'clearQueue') {
            guildQueue.clearQueue();
        }

        if (command === 'shuffle') {
            guildQueue.shuffle();
        }

        if (command === 'getQueue') {
            console.log(guildQueue);
        }

        if (command === 'getVolume') {
            console.log(guildQueue.volume)
        }

        if (command === 'nowPlaying') {
            console.log(`Now playing: ${guildQueue.nowPlaying}`);
        }

        if (command === 'pause') {
            guildQueue.setPaused(true);
        }

        if (command === 'resume') {
            guildQueue.setPaused(false);
        }

        if (command === 'remove') {
            guildQueue.remove(parseInt(args[0]));
        }

        if (command === 'createProgressBar') {
            const ProgressBar = guildQueue.createProgressBar();

            // [======>              ][00:35/2:20]
            console.log(ProgressBar.prettier);
        }
    })
}

client.on("ready", async () => {
    await playerAction();

    client.player.on('songFirst', (queue, song) => {
        if (!song.name) {
            return;
        }

        const getSong = songData.find(i => i.songData?.name ?? null === song.name);

        if (getSong) {
            const channel = client.channels.cache.get(getSong.channel);

            channel.send(`\`\`\`▶️ Now playing: \n\n Song: ${song.name} \n\n Autor: ${song.author} \n \n ⌛ ${song.duration}min\`\`\`  \n requested by <@${getSong.memberObject.id}>`);

            songData = songData.filter(function (el) {
                return el.songData.name !== song.name;
            });
        }
    })

    client.player.on('songChanged', (queue, songNew) => {
        if (!songNew.name) {
            return;
        }

        const getSong = songData.find(i => i.songData?.name ?? null === songNew.name);

        if (getSong) {
            const channel = client.channels.cache.get(getSong.channel);

            channel.send(`\`\`\`▶️ Now playing: \n\n Song: ${songNew.name} \n\n Autor: ${songNew.author} \n \n ⌛ ${songNew.duration}min\`\`\`  \n requested by <@${getSong.memberObject.id}>`);

            songData = songData.filter(function (el) {
                return el.songData.name !== songNew.name;
            });
        }
    })
});

client.login(settings.token);