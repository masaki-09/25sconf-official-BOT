require('dotenv').config();

const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: []
});

// 環境変数から設定を読み込み
const CONFIG = {
  TOKEN: process.env.BOT_TOKEN,
  SLIDE: {
    MESSAGE_ID: process.env.SLIDE_MESSAGE_ID,
    CHANNEL_ID: process.env.SLIDE_CHANNEL_ID,
    CATEGORY_ID: process.env.SLIDE_CATEGORY_ID,
    EMOJI: process.env.SLIDE_EMOJI || '📤'
  },
  INQUIRY: {
    MESSAGE_ID: process.env.INQUIRY_MESSAGE_ID,
    CHANNEL_ID: process.env.INQUIRY_CHANNEL_ID,
    CATEGORY_ID: process.env.INQUIRY_CATEGORY_ID,
    EMOJI: process.env.INQUIRY_EMOJI || '💬'
  },
  ROLES: {
    MESSAGE_ID: process.env.ROLE_MESSAGE_ID,
    PARTICIPANT_EMOJI: process.env.PARTICIPANT_EMOJI || '25sconf',
    PARTICIPANT_ROLE_ID: process.env.PARTICIPANT_ROLE_ID,
    VIEWER_EMOJI: process.env.VIEWER_EMOJI || '👁️',
    VIEWER_ROLE_ID: process.env.VIEWER_ROLE_ID
  },
  WELCOME: {
    CHANNEL_ID: process.env.WELCOME_CHANNEL_ID,
    MESSAGE: process.env.WELCOME_MESSAGE || 'ようこそ！まずはロール設定チャンネルで参加登録をお願いします。'
  }
};

// 設定値のチェック
if (!CONFIG.TOKEN) {
  console.error('エラー: BOT_TOKENが設定されていません');
  process.exit(1);
}

// 既に作成されたチャンネルを記録
const slideChannels = new Map();
const inquiryChannels = new Map();

client.once('ready', async () => {
  console.log(`Botがログインしました: ${client.user.tag}`);
  
  // スライド用リアクション追加
  if (CONFIG.SLIDE.MESSAGE_ID && CONFIG.SLIDE.CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(CONFIG.SLIDE.CHANNEL_ID);
      const message = await channel.messages.fetch(CONFIG.SLIDE.MESSAGE_ID);
      await message.react(CONFIG.SLIDE.EMOJI);
      console.log('スライド用リアクションを追加しました');
    } catch (error) {
      console.error('スライド用リアクション追加エラー:', error);
    }
  }

  // お問い合わせ用リアクション追加
  if (CONFIG.INQUIRY.MESSAGE_ID && CONFIG.INQUIRY.CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(CONFIG.INQUIRY.CHANNEL_ID);
      const message = await channel.messages.fetch(CONFIG.INQUIRY.MESSAGE_ID);
      await message.react(CONFIG.INQUIRY.EMOJI);
      console.log('お問い合わせ用リアクションを追加しました');
    } catch (error) {
      console.error('お問い合わせ用リアクション追加エラー:', error);
    }
  }

  // ロール付与用リアクション追加
  if (CONFIG.ROLES.MESSAGE_ID && CONFIG.ROLES.PARTICIPANT_EMOJI && CONFIG.ROLES.VIEWER_EMOJI) {
    try {
      const guild = client.guilds.cache.first();
      const channels = await guild.channels.fetch();
      
      let roleMessage = null;
      for (const [, channel] of channels) {
        if (channel.isTextBased()) {
          try {
            roleMessage = await channel.messages.fetch(CONFIG.ROLES.MESSAGE_ID);
            if (roleMessage) break;
          } catch (err) {
            continue;
          }
        }
      }

      if (roleMessage) {
        // 参加予定者の絵文字を追加
        if (CONFIG.ROLES.PARTICIPANT_EMOJI) {
          // カスタム絵文字の場合（数字のみ）
          if (/^\d+$/.test(CONFIG.ROLES.PARTICIPANT_EMOJI)) {
            await roleMessage.react(CONFIG.ROLES.PARTICIPANT_EMOJI);
          } else {
            // 通常の絵文字
            await roleMessage.react(CONFIG.ROLES.PARTICIPANT_EMOJI);
          }
        }
        
        // 閲覧者の絵文字を追加
        if (CONFIG.ROLES.VIEWER_EMOJI) {
          await roleMessage.react(CONFIG.ROLES.VIEWER_EMOJI);
        }
        
        console.log('ロール付与用リアクションを追加しました');
      }
    } catch (error) {
      console.error('ロール付与用リアクション追加エラー:', error);
    }
  } else {
    console.log('ロール付与機能: 設定が不完全なためスキップしました');
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

  const guild = reaction.message.guild;

  // ロール付与機能
  if (reaction.message.id === CONFIG.ROLES.MESSAGE_ID) {
    try {
      const member = await guild.members.fetch(user.id);
      
      // カスタム絵文字の判定
      const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;
      
      // 参加予定者ロール
      if (emojiIdentifier === CONFIG.ROLES.PARTICIPANT_EMOJI || 
          reaction.emoji.name === CONFIG.ROLES.PARTICIPANT_EMOJI) {
        if (CONFIG.ROLES.PARTICIPANT_ROLE_ID) {
          const role = guild.roles.cache.get(CONFIG.ROLES.PARTICIPANT_ROLE_ID);
          if (role) {
            await member.roles.add(role);
            console.log(`${user.tag} に「${role.name}」ロールを付与しました`);
          }
        }
      }
      
      // 閲覧者ロール
      if (emojiIdentifier === CONFIG.ROLES.VIEWER_EMOJI || 
          reaction.emoji.name === CONFIG.ROLES.VIEWER_EMOJI) {
        if (CONFIG.ROLES.VIEWER_ROLE_ID) {
          const role = guild.roles.cache.get(CONFIG.ROLES.VIEWER_ROLE_ID);
          if (role) {
            await member.roles.add(role);
            console.log(`${user.tag} に「${role.name}」ロールを付与しました`);
          }
        }
      }
    } catch (error) {
      console.error('ロール付与エラー:', error);
    }
    return;
  }

  const adminRole = guild.roles.cache.find(role => 
    role.permissions.has(PermissionFlagsBits.Administrator)
  );

  // スライド共有チャンネル作成
  if (reaction.message.id === CONFIG.SLIDE.MESSAGE_ID && 
      reaction.emoji.name === CONFIG.SLIDE.EMOJI) {
    
    if (slideChannels.has(user.id)) {
      console.log(`${user.tag} は既にスライドチャンネルを持っています`);
      return;
    }

    try {
      const channelName = `slides-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const privateChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CONFIG.SLIDE.CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      if (adminRole) {
        await privateChannel.permissionOverwrites.create(adminRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
      }

      slideChannels.set(user.id, privateChannel.id);

      await privateChannel.send(
        `<@${user.id}> さん、スライド共有用のプライベートチャンネルへようこそ!\n\n` +
        `こちらにスライドファイルをアップロードしてください。\n` +
        `このチャンネルはあなたと管理者のみが閲覧できます。\n\n` +
        `**提出ファイル形式**\n` +
        `• 基本：pptx（PowerPoint形式）\n` +
        `• 例外：pdf形式（Canva等で作成し、pptxで出力するとレイアウトが崩れる場合）`
      );

      console.log(`${user.tag} 用のスライドチャンネル ${channelName} を作成しました`);
    } catch (error) {
      console.error('スライドチャンネル作成エラー:', error);
    }
  }

  // お問い合わせチャンネル作成
  if (reaction.message.id === CONFIG.INQUIRY.MESSAGE_ID && 
      reaction.emoji.name === CONFIG.INQUIRY.EMOJI) {
    
    if (inquiryChannels.has(user.id)) {
      console.log(`${user.tag} は既にお問い合わせチャンネルを持っています`);
      return;
    }

    try {
      const channelName = `inquiry-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      const privateChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: CONFIG.INQUIRY.CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ]
      });

      if (adminRole) {
        await privateChannel.permissionOverwrites.create(adminRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          ManageMessages: true
        });
      }

      inquiryChannels.set(user.id, privateChannel.id);

      await privateChannel.send(
        `<@${user.id}> さん、お問い合わせチャンネルへようこそ!\n\n` +
        `運営スタッフが対応いたしますので、お気軽にご質問・ご相談ください。\n` +
        `このチャンネルはあなたと運営スタッフのみが閲覧できます。\n\n` +
        `📝 **お問い合わせ内容をこちらに送信してください**`
      );

      console.log(`${user.tag} 用のお問い合わせチャンネル ${channelName} を作成しました`);
    } catch (error) {
      console.error('お問い合わせチャンネル作成エラー:', error);
    }
  }
});

// リアクション削除時の処理
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  const guild = reaction.message.guild;

  // ロール削除機能
  if (reaction.message.id === CONFIG.ROLES.MESSAGE_ID) {
    try {
      const member = await guild.members.fetch(user.id);
      
      const emojiIdentifier = reaction.emoji.id || reaction.emoji.name;
      
      // 参加予定者ロール削除
      if (emojiIdentifier === CONFIG.ROLES.PARTICIPANT_EMOJI || 
          reaction.emoji.name === CONFIG.ROLES.PARTICIPANT_EMOJI) {
        if (CONFIG.ROLES.PARTICIPANT_ROLE_ID) {
          const role = guild.roles.cache.get(CONFIG.ROLES.PARTICIPANT_ROLE_ID);
          if (role) {
            await member.roles.remove(role);
            console.log(`${user.tag} から「${role.name}」ロールを削除しました`);
          }
        }
      }
      
      // 閲覧者ロール削除
      if (emojiIdentifier === CONFIG.ROLES.VIEWER_EMOJI || 
          reaction.emoji.name === CONFIG.ROLES.VIEWER_EMOJI) {
        if (CONFIG.ROLES.VIEWER_ROLE_ID) {
          const role = guild.roles.cache.get(CONFIG.ROLES.VIEWER_ROLE_ID);
          if (role) {
            await member.roles.remove(role);
            console.log(`${user.tag} から「${role.name}」ロールを削除しました`);
          }
        }
      }
    } catch (error) {
      console.error('ロール削除エラー:', error);
    }
    return;
  }

  // スライドチャンネル削除
  if (reaction.message.id === CONFIG.SLIDE.MESSAGE_ID && 
      reaction.emoji.name === CONFIG.SLIDE.EMOJI) {
    const channelId = slideChannels.get(user.id);
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          await channel.delete('ユーザーがリアクションを削除したため');
          slideChannels.delete(user.id);
          console.log(`${user.tag} のスライドチャンネルを削除しました`);
        }
      } catch (error) {
        console.error('スライドチャンネル削除エラー:', error);
      }
    }
  }

  // お問い合わせチャンネル削除
  if (reaction.message.id === CONFIG.INQUIRY.MESSAGE_ID && 
      reaction.emoji.name === CONFIG.INQUIRY.EMOJI) {
    const channelId = inquiryChannels.get(user.id);
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          await channel.delete('ユーザーがリアクションを削除したため');
          inquiryChannels.delete(user.id);
          console.log(`${user.tag} のお問い合わせチャンネルを削除しました`);
        }
      } catch (error) {
        console.error('お問い合わせチャンネル削除エラー:', error);
      }
    }
  }
});

client.login(CONFIG.TOKEN);