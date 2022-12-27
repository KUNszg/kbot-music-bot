const Discord = require("discord.js");
const config = require("./config");
const amqplib = require('amqplib');
const {Player} = require("discord-music-player");

const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});

const settings = {
    prefix: '%',
    token: config.token
};

const player = new Player(client, {
    leaveOnEnd: false,
    leaveOnStop: true,
    leaveOnEmpty: false,
    deafenOnJoin: false,
    volume: 100,
    quality: 'high'
});

client.player = player;

const queue = 'KBOT.MUSIC_PLAYER';

const opt = {credentials: require('amqplib').credentials.plain(config.rabbitUser, config.rabbitPass)};

const conn = await amqplib.connect(config.rabbitUrl, opt);

const rabbitConsumer = await conn.createChannel();
await rabbitConsumer.assertQueue(queue);

let songData = [];

(async () => {
    // Rabbit listener
    // rabbitConsumer.consume(queue, (msg) => {
    //     if (msg !== null) {
    //         console.log('Recieved:', msg.content.toString());
    //         rabbitConsumer.ack(msg);
    //     } else {
    //         console.log('Consumer cancelled by server');
    //     }
    // });

    // Rabbit sender
    const publishMessage = await conn.createChannel();

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

                const songObject = {
                    guildObject: Guild,
                    memberObject: Member,
                    guild: message.guild.id,
                    channel: message.channel.id,
                    songData: song
                };

                songData.push(songObject);

                publishMessage.sendToQueue(queue, Buffer.from(JSON.stringify(songObject)));
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
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.stop();
            }

            if (command === 'removeLoop') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setRepeatMode(RepeatMode.DISABLED); // or 0 instead of RepeatMode.DISABLED
            }

            if (command === 'toggleLoop') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setRepeatMode(RepeatMode.SONG); // or 1 instead of RepeatMode.SONG
            }

            if (command === 'toggleQueueLoop') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setRepeatMode(RepeatMode.QUEUE); // or 2 instead of RepeatMode.QUEUE
            }

            if (command === 'setVolume') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setVolume(parseInt(args[0]));
            }

            if (command === 'seek') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.seek(parseInt(args[0]) * 1000);
            }

            if (command === 'clearQueue') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.clearQueue();
            }

            if (command === 'shuffle') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

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
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setPaused(true);
            }

            if (command === 'resume') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.setPaused(false);
            }

            if (command === 'remove') {
                if (!Member.voice.channel) {
                    await message.reply("You are not in a voice channel!");
                    return;
                }

                guildQueue.remove(parseInt(args[0]));
            }

            if (command === 'createProgressBar') {
                const ProgressBar = guildQueue.createProgressBar();

                // [======>              ][00:35/2:20]
                console.log(ProgressBar.prettier);
            }
        })
    }

    const sendMessage = (queue, song) => {
        if (!song.name) {
            return;
        }

        const getSong = songData.find(i => i.songData?.name ?? null === song.name);

        if (getSong) {
            const channel = client.channels.cache.get(getSong.channel);

            channel.send(`\`\`\`▶️ Now playing: \n\n Song: ${song.name} \n\n Author: ${song.author} \n \n ⌛ ${song.duration} min\`\`\`  \n requested by <@${getSong.memberObject.id}>`);

            songData = songData.filter(function (el) {
                return el.songData.name !== song.name;
            });
        }
    }

    client.on("ready", async () => {
        await playerAction();

        client.player.on('songFirst', (queue, song) => {
            sendMessage(queue, song);
        });

        client.player.on('songChanged', (queue, song) => {
            sendMessage(queue, song);
        });

        client.player.on('songAdd', (queue, song) => {
            sendMessage(queue, song);
        });
    });

    client.login(settings.token);
})();