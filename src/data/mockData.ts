export interface Story {
  id: string;
  username: string;
  avatar: string;
  isOwn?: boolean;
  hasStory?: boolean;
  isLive?: boolean;
  storyNote?: string;
}

export interface Post {
  id: string;
  username: string;
  avatar: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  timeAgo: string;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isVerified?: boolean;
  location?: string;
  videoUrl?: string;
  isVideo?: boolean;
}

export interface ExploreItem {
  id: string;
  image: string;
  isReel?: boolean;
}

export interface UserProfile {
  username: string;
  fullName: string;
  avatar: string;
  bio: string;
  posts: number;
  followers: number;
  following: number;
  isVerified?: boolean;
  website?: string;
}

export const stories: Story[] = [
  { id: "own", username: "Your story", avatar: "https://i.pravatar.cc/150?img=33", isOwn: true },
  { id: "1", username: "jake.miller_", avatar: "https://i.pravatar.cc/150?img=1", hasStory: true },
  { id: "2", username: "emma.rose.x", avatar: "https://i.pravatar.cc/150?img=3", hasStory: true },
  { id: "3", username: "tyler_wilson", avatar: "https://i.pravatar.cc/150?img=5", hasStory: true },
  { id: "4", username: "olivia.grace", avatar: "https://i.pravatar.cc/150?img=7", hasStory: true },
  { id: "5", username: "_noah.james_", avatar: "https://i.pravatar.cc/150?img=9", hasStory: true },
  { id: "6", username: "harry.styles.fan", avatar: "https://i.pravatar.cc/150?img=11", hasStory: true },
  { id: "7", username: "chloe__uk", avatar: "https://i.pravatar.cc/150?img=13", hasStory: true },
  { id: "8", username: "liam.carter", avatar: "https://i.pravatar.cc/150?img=15", hasStory: true },
  { id: "9", username: "mason.reed", avatar: "https://i.pravatar.cc/150?img=17", hasStory: true },
  { id: "10", username: "sophia.blake", avatar: "https://i.pravatar.cc/150?img=19", hasStory: true },
  { id: "11", username: "_ethan.cole_", avatar: "https://i.pravatar.cc/150?img=21", hasStory: true },
  { id: "12", username: "charlotte.uk", avatar: "https://i.pravatar.cc/150?img=23", hasStory: true },
  { id: "13", username: "logan.x", avatar: "https://i.pravatar.cc/150?img=25", hasStory: true },
  { id: "14", username: "amelia_edits", avatar: "https://i.pravatar.cc/150?img=27", hasStory: true },
  { id: "15", username: "ryan_07", avatar: "https://i.pravatar.cc/150?img=29", hasStory: true },
];

const allPosts: Post[] = [
  {
    id: "1",
    username: "emma.rose.x",
    avatar: "https://i.pravatar.cc/150?img=3",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&h=600&fit=crop",
    caption: "Golden hour magic ✨ #nature #sunset #photography",
    likes: 1243,
    comments: 48,
    timeAgo: "2 hours ago",
    location: "Central Park, NYC",
    isVerified: false,
  },
  {
    id: "2",
    username: "tyler_wilson",
    avatar: "https://i.pravatar.cc/150?img=5",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=600&fit=crop",
    caption: "New workspace setup 🖥️ What do you think? #minimal #desk #workspace",
    likes: 892,
    comments: 35,
    timeAgo: "4 hours ago",
    location: "San Francisco, CA",
  },
  {
    id: "3",
    username: "harry.styles.fan",
    avatar: "https://i.pravatar.cc/150?img=11",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop",
    caption: "Homemade pasta night 🍝 Recipe in bio! #foodie #cooking #homemade",
    likes: 2156,
    comments: 92,
    timeAgo: "6 hours ago",
  },
  {
    id: "4",
    username: "olivia.grace",
    avatar: "https://i.pravatar.cc/150?img=7",
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&h=600&fit=crop",
    caption: "Weekend adventure 🏔️ #travel #explore #mountains",
    likes: 3401,
    comments: 127,
    timeAgo: "8 hours ago",
    location: "Lake District, UK",
    isVerified: false,
  },
  {
    id: "5",
    username: "_noah.james_",
    avatar: "https://i.pravatar.cc/150?img=9",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&h=600&fit=crop",
    caption: "Nature therapy 🌿 #nature #peace #vibes",
    likes: 4521,
    comments: 201,
    timeAgo: "10 hours ago",
    location: "Colorado, USA",
  },
  {
    id: "6",
    username: "mevidyutjammwal",
    avatar: "https://i.pravatar.cc/150?img=52",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=600&fit=crop",
    caption: "Standing strong with my fellow warriors 💪 #strength #motivation",
    likes: 1100000,
    comments: 4374,
    timeAgo: "2 days ago",
    isVerified: true,
  },
  {
    id: "7",
    username: "chloe__uk",
    avatar: "https://i.pravatar.cc/150?img=13",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
    caption: "Music is life 🎵🔥 #edit #music #vibe",
    likes: 5672,
    comments: 312,
    timeAgo: "3 hours ago",
    location: "London, UK",
  },
  {
    id: "8",
    username: "liam.carter",
    avatar: "https://i.pravatar.cc/150?img=15",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop",
    caption: "Confidence is silent, insecurities are loud 🤫 #attitude #style",
    likes: 8934,
    comments: 456,
    timeAgo: "5 hours ago",
    isVerified: false,
  },
  {
    id: "9",
    username: "mason.reed",
    avatar: "https://i.pravatar.cc/150?img=17",
    image: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=600&fit=crop",
    caption: "Lost in the wilderness 🌲 #wanderlust #explore #wild",
    likes: 6789,
    comments: 234,
    timeAgo: "1 day ago",
    location: "Yorkshire, UK",
  },
  {
    id: "10",
    username: "sophia.blake",
    avatar: "https://i.pravatar.cc/150?img=19",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=600&fit=crop",
    caption: "Beach vibes only 🏖️🌊 #beach #sunset #ocean",
    likes: 12450,
    comments: 567,
    timeAgo: "12 hours ago",
    location: "Miami Beach, FL",
    isVerified: true,
  },
  {
    id: "11",
    username: "_ethan.cole_",
    avatar: "https://i.pravatar.cc/150?img=21",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop",
    caption: "Portrait mood 📸 #portrait #photography #mood",
    likes: 3456,
    comments: 89,
    timeAgo: "7 hours ago",
  },
  {
    id: "12",
    username: "charlotte.uk",
    avatar: "https://i.pravatar.cc/150?img=23",
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=600&fit=crop",
    caption: "Morning fog in the valley 🌫️ #nature #morning #peace",
    likes: 7823,
    comments: 345,
    timeAgo: "1 day ago",
    location: "Edinburgh, UK",
  },
  {
    id: "13",
    username: "logan.x",
    avatar: "https://i.pravatar.cc/150?img=25",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=600&fit=crop",
    caption: "Tech life 💻⚡ #coding #developer #tech",
    likes: 2345,
    comments: 67,
    timeAgo: "9 hours ago",
  },
  {
    id: "14",
    username: "amelia_edits",
    avatar: "https://i.pravatar.cc/150?img=27",
    image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=600&h=600&fit=crop",
    caption: "Flowers don't compete, they just bloom 🌸 #flowers #nature",
    likes: 9876,
    comments: 432,
    timeAgo: "2 days ago",
    location: "Cotswolds, UK",
    isVerified: false,
  },
  {
    id: "15",
    username: "ryan_07",
    avatar: "https://i.pravatar.cc/150?img=29",
    image: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=600&h=600&fit=crop",
    caption: "Living the dream ✈️🌍 #travel #adventure #life",
    likes: 15600,
    comments: 789,
    timeAgo: "3 days ago",
    isVerified: true,
  },
];

// Shuffle and pick random posts each time
const shuffleArray = <T,>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const posts: Post[] = shuffleArray(allPosts);

export const exploreItems: ExploreItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  image: `https://images.unsplash.com/photo-${1500000000000 + i * 5000000}?w=300&h=300&fit=crop`,
  isReel: i % 5 === 3,
}));

export const exploreImages = [
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1482685945432-29f7ec5ccb78?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=300&h=300&fit=crop",
];

export const currentUser: UserProfile = {
  username: "Organicsmm.pro",
  fullName: "OrganicSMM",
  avatar: "https://i.pravatar.cc/150?img=33",
  bio: "ᴛʜᴇ ᴜʟᴛɪᴍᴀᴛᴇ ᴄʀᴇᴀᴛᴏʀ ᴛᴏᴏʟ 🛠️\nᴄᴜꜱᴛᴏᴍɪᴢᴇ ʏᴏᴜʀ ɪɢ ᴀɴᴀʟʏᴛɪᴄꜱ 📊\nɢʟᴏʙᴀʟ ʀᴇᴀᴄʜ ꜱɪᴍᴜʟᴀᴛᴏʀ 🌍\n👇 ᴄʜᴀɴɢᴇ ʏᴏᴜʀ ꜱᴛᴀᴛꜱ ᴛᴏᴅᴀʏ",
  posts: 21,
  followers: 12530,
  following: 12,
  isVerified: true,
  website: "Organicsmm.pro",
};

export const userPostImages = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop",
];

// Post item with thumbnail + optional video URL
export interface PostItem {
  thumbnail: string;
  videoUrl?: string;
}

// Multiple mock profiles for account switching
export interface MockAccount {
  profile: UserProfile;
  posts: PostItem[];
  highlights: { name: string; image: string }[];
  storyNote?: string;
  category?: string;
  channelText?: string;
  dashboardViews?: string;
  postsDisplay?: string;
  followersDisplay?: string;
  followingDisplay?: string;
}

export const mockAccounts: Record<string, MockAccount> = {
  "b4by_4ngel_": {
    profile: currentUser,
    posts: userPostImages.map(img => ({ thumbnail: img })),
    highlights: [
      { name: "💕GloWth-💕", image: "https://i.pravatar.cc/150?img=47" },
      { name: "✨Channel★", image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=100&h=100&fit=crop" },
    ],
    storyNote: "Staying in or going out?",
    category: "Dancer",
    channelText: "🔍 🚀NANCY🦋WORLD🚀 1,288 members",
    dashboardViews: "37.3K",
  },
  "virat.kohli": {
    profile: {
      username: "virat.kohli",
      fullName: "Virat Kohli",
      avatar: "https://i.pravatar.cc/150?img=52",
      bio: "🇮🇳 Indian Cricketer\n🏏 Royal Challengers Bangalore\n❤️ Father | Husband | Cricketer",
      posts: 1243,
      followers: 272000000,
      following: 238,
      isVerified: true,
      website: "virat.kohli.com",
    },
    posts: [
      { thumbnail: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=300&h=300&fit=crop" },
    ],
    highlights: [
      { name: "🏏 Cricket", image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=100&h=100&fit=crop" },
      { name: "💪 Fitness", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=100&h=100&fit=crop" },
      { name: "👨‍👩‍👧 Family", image: "https://i.pravatar.cc/150?img=32" },
    ],
    storyNote: "Game day energy ⚡",
    category: "Athlete",
    channelText: "🏏 Team India 🇮🇳",
    dashboardViews: "12.5M",
  },
  "photography_art": {
    profile: {
      username: "photography_art",
      fullName: "📸 Art of Photography",
      avatar: "https://i.pravatar.cc/150?img=36",
      bio: "Professional Photographer 📷\n🌍 Travel | Nature | Portrait\n📩 DM for collab\n🔗 Portfolio below ⬇️",
      posts: 456,
      followers: 850000,
      following: 312,
      isVerified: true,
      website: "photographyart.com",
    },
    posts: [
      { thumbnail: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1418065460487-3e41a6c84dc5?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=300&h=300&fit=crop" },
    ],
    highlights: [
      { name: "🌅 Sunsets", image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=100&h=100&fit=crop" },
      { name: "🏔️ Mountains", image: "https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?w=100&h=100&fit=crop" },
      { name: "🌊 Ocean", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100&h=100&fit=crop" },
    ],
    storyNote: "New shots dropping soon 📸",
    category: "Photographer",
    channelText: "📸 Photo Community 45K members",
    dashboardViews: "2.1M",
  },
  "foodie_queen": {
    profile: {
      username: "foodie_queen",
      fullName: "Priya Sharma 🍕",
      avatar: "https://i.pravatar.cc/150?img=45",
      bio: "Food Blogger | Chef 👩‍🍳\n🍜 Indian | Italian | Thai\n📍 Mumbai, India\n🎬 YouTube: 500K subs",
      posts: 892,
      followers: 1200000,
      following: 567,
      isVerified: true,
      website: "foodiequeen.in",
    },
    posts: [
      { thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1432139509613-5c4255a78e03?w=300&h=300&fit=crop" },
    ],
    highlights: [
      { name: "🍝 Recipes", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=100&fit=crop" },
      { name: "🍰 Desserts", image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop" },
      { name: "🌮 Street", image: "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=100&h=100&fit=crop" },
    ],
    storyNote: "What should I cook today? 🤔",
    category: "Food Blogger",
    channelText: "🍕 Foodie Fam 12K members",
    dashboardViews: "4.8M",
  },
  "tech_guru_": {
    profile: {
      username: "tech_guru_",
      fullName: "Rahul Tech 💻",
      avatar: "https://i.pravatar.cc/150?img=60",
      bio: "Tech Reviewer | Gadgets 📱\n🎮 Gaming | Unboxing\n📺 YouTube: 2M subs\n🔔 Turn on notifications!",
      posts: 334,
      followers: 3500000,
      following: 189,
      isVerified: true,
      website: "techguru.co",
    },
    posts: [
      { thumbnail: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=300&h=300&fit=crop" },
    ],
    highlights: [
      { name: "📱 Reviews", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=100&h=100&fit=crop" },
      { name: "🎮 Gaming", image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=100&h=100&fit=crop" },
      { name: "💻 Setup", image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=100&h=100&fit=crop" },
    ],
    storyNote: "New iPhone review out! 📱",
    category: "Tech Blogger",
    channelText: "💻 Tech Community 8K members",
    dashboardViews: "8.2M",
  },
  "just4abhii": {
    profile: currentUser,
    posts: [
      { thumbnail: "https://cdn-cf-east.streamable.com/image/owo7oy.jpg", videoUrl: "https://streamable.com/owo7oy" },
      { thumbnail: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop" },
      { thumbnail: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&h=300&fit=crop" },
    ],
    highlights: [
      { name: "🔥 Viral", image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=100&h=100&fit=crop" },
      { name: "💻 Tools", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" },
      { name: "📈 Results", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" },
    ],
    storyNote: "New Dashboard Features Live 🔥",
    category: "Software/App",
    channelText: "🚀 OrganicSMM Updates 10K members",
    dashboardViews: "98.5M",
  },
};

// Persistence: load saved profile overrides from localStorage
const PROFILE_STORAGE_KEY = "ig_profile_overrides";

const loadProfileOverrides = () => {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (saved) {
      const overrides = JSON.parse(saved);
      // Apply overrides to existing accounts AND create renamed accounts
      for (const [username, data] of Object.entries(overrides)) {
        if (!data || typeof data !== 'object') continue;
        const d = data as any;
        let acc = mockAccounts[username];
        if (!acc && d.profile) {
          // Username was changed — create entry with saved data
          acc = {
            profile: { ...currentUser, ...d.profile },
            posts: mockAccounts["just4abhii"]?.posts || [],
            highlights: d.highlights || [],
            storyNote: d.storyNote,
            category: d.category,
            dashboardViews: d.dashboardViews,
            postsDisplay: d.postsDisplay,
            followersDisplay: d.followersDisplay,
            followingDisplay: d.followingDisplay,
          };
          mockAccounts[username] = acc;
        }
        if (acc) {
          if (d.profile) Object.assign(acc.profile, d.profile);
          if (d.storyNote !== undefined) acc.storyNote = d.storyNote;
          if (d.category !== undefined) acc.category = d.category;
          if (d.dashboardViews !== undefined) acc.dashboardViews = d.dashboardViews;
          if (d.postsDisplay !== undefined) acc.postsDisplay = d.postsDisplay;
          if (d.followersDisplay !== undefined) acc.followersDisplay = d.followersDisplay;
          if (d.followingDisplay !== undefined) acc.followingDisplay = d.followingDisplay;
          if (d.highlights) acc.highlights = d.highlights;
        }
      }
      // Sync currentUser from just4abhii or any account sharing the reference
      const just4abhii = mockAccounts["just4abhii"];
      const syncFrom = just4abhii || Object.values(mockAccounts).find(a => a.profile === currentUser);
      if (syncFrom) {
        currentUser.username = syncFrom.profile.username;
        currentUser.fullName = syncFrom.profile.fullName;
        currentUser.avatar = syncFrom.profile.avatar;
        currentUser.bio = syncFrom.profile.bio;
        currentUser.posts = syncFrom.profile.posts;
        currentUser.followers = syncFrom.profile.followers;
        currentUser.following = syncFrom.profile.following;
        currentUser.isVerified = syncFrom.profile.isVerified;
      }
    }
  } catch { }
};

export const saveProfileOverrides = () => {
  try {
    const overrides: Record<string, any> = {};
    for (const [username, acc] of Object.entries(mockAccounts)) {
      overrides[username] = {
        profile: { ...acc.profile },
        storyNote: acc.storyNote,
        category: acc.category,
        dashboardViews: acc.dashboardViews,
        postsDisplay: acc.postsDisplay,
        followersDisplay: acc.followersDisplay,
        followingDisplay: acc.followingDisplay,
        highlights: acc.highlights,
      };
    }
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(overrides));
  } catch { }
};

// Load on module init
loadProfileOverrides();

// Helper to find account by username (case-insensitive partial match)
export const findMockAccount = (username: string): MockAccount | null => {
  const lower = username.toLowerCase().trim();
  if (!lower) return null;
  const exact = Object.keys(mockAccounts).find(k => k.toLowerCase() === lower);
  if (exact) return mockAccounts[exact];
  const partial = Object.keys(mockAccounts).find(k => k.toLowerCase().includes(lower));
  if (partial) return mockAccounts[partial];
  return null;
};

// --- Feed Videos (uploaded by user, shown on home page) ---
export interface FeedVideo {
  id: string;
  videoUrl: string;
  username: string;
  avatar: string;
  caption: string;
  likes: number;
  comments: number;
  timeAgo: string;
  isVerified?: boolean;
}

const FEED_VIDEOS_KEY = "ig_feed_videos";

export const loadFeedVideos = (): FeedVideo[] => {
  try {
    const saved = localStorage.getItem(FEED_VIDEOS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

export const saveFeedVideo = (video: FeedVideo) => {
  try {
    const existing = loadFeedVideos();
    existing.unshift(video);
    localStorage.setItem(FEED_VIDEOS_KEY, JSON.stringify(existing));
  } catch { }
};

export const removeFeedVideo = (id: string) => {
  try {
    const existing = loadFeedVideos().filter(v => v.id !== id);
    localStorage.setItem(FEED_VIDEOS_KEY, JSON.stringify(existing));
  } catch { }
};
