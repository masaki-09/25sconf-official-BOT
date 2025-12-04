require('dotenv').config();

const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ]
});

// 環境変数から設定を読み込み
const CONFIG = {
  TOKEN: process.env.BOT_TOKEN,
  MESSAGE_ID: process.env.MESSAGE_ID,
  CHANNEL_ID: process.env.CHANNEL_ID,
  CATEGORY_ID: process.env.CATEGORY_ID,
  EMOJI: process.env.EMOJI || '📤'
};

// 設定値のチェック
if (!CONFIG.TOKEN || !CONFIG.MESSAGE_ID || !CONFIG.CHANNEL_ID || !CONFIG.CATEGORY_ID) {
  console.error('エラー: .envファイルに必要な設定が不足しています');
  process.exit(1);
}

// 既に作成されたチャンネルを記録
const userChannels = new Map();

client.once('ready', async () => {
  console.log(`Botがログインしました: ${client.user.tag}`);
  
  // 起動時に対象メッセージにリアクションを追加
  try {
    const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);
    const message = await channel.messages.fetch(CONFIG.MESSAGE_ID);
    await message.react(CONFIG.EMOJI);
    console.log('初期リアクションを追加しました');
  } catch (error) {
    console.error('初期リアクション追加エラー:', error);
  }
});

// リアクション追加時の処理
client.on('messageReactionAdd', async (reaction, user) => {
  // Botの反応は無視
  if (user.bot) return;

  // パーシャルの場合はフェッチ
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('リアクションのフェッチエラー:', error);
      return;
    }
  }

  // 指定されたメッセージとリアクションかチェック
  if (reaction.message.id !== CONFIG.MESSAGE_ID) return;
  if (reaction.emoji.name !== CONFIG.EMOJI) return;

  // 既にチャンネルを作成済みかチェック
  if (userChannels.has(user.id)) {
    console.log(`${user.tag} は既にチャンネルを持っています`);
    return;
  }

  try {
    const guild = reaction.message.guild;
    
    // 管理者ロールを取得
    const adminRole = guild.roles.cache.find(role => 
      role.permissions.has(PermissionFlagsBits.Administrator)
    );

    // プライベートチャンネルを作成
    const channelName = `slides-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    const privateChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORY_ID,
      permissionOverwrites: [
        {
          // @everyone - 閲覧不可
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          // リアクションしたユーザー - 閲覧・送信可能
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        {
          // Bot自身 - 全権限
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ]
    });

    // 管理者ロールがある場合は権限を追加
    if (adminRole) {
      await privateChannel.permissionOverwrites.create(adminRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
    }

    // チャンネルを記録
    userChannels.set(user.id, privateChannel.id);

    // ウェルカムメッセージを送信
    await privateChannel.send(
      `<@${user.id}> さん、スライド共有用のプライベートチャンネルへようこそ!\n\n` +
      `こちらにスライドファイルをアップロードしてください。\n` +
      `このチャンネルはあなたと管理者のみが閲覧できます。`
    );

    console.log(`${user.tag} 用のプライベートチャンネル ${channelName} を作成しました`);

  } catch (error) {
    console.error('チャンネル作成エラー:', error);
  }
});

// リアクション削除時の処理(オプション)
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  
  if (reaction.message.id !== CONFIG.MESSAGE_ID) return;
  if (reaction.emoji.name !== CONFIG.EMOJI) return;

  const channelId = userChannels.get(user.id);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.delete('ユーザーがリアクションを削除したため');
      userChannels.delete(user.id);
      console.log(`${user.tag} のチャンネルを削除しました`);
    }
  } catch (error) {
    console.error('チャンネル削除エラー:', error);
  }
});

client.login(CONFIG.TOKEN);