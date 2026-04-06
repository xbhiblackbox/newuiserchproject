import { useState, useMemo } from "react";
import { ChevronLeft, Edit, Camera, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { currentUser, mockAccounts } from "@/data/mockData";

interface ChatItem {
    id: string;
    username: string;
    fullName: string;
    avatar: string;
    lastMessage: string;
    timeAgo: string;
    isVerified?: boolean;
    unread?: boolean;
    unreadCount?: number;
    isOnline?: boolean;
    isTyping?: boolean;
    isSentByYou?: boolean;
    hasStory?: boolean;
    isGroup?: boolean;
    groupMembers?: number;
}

const mockChats: ChatItem[] = [
    {
        id: "1",
        username: "jake.miller_",
        fullName: "Jake Miller",
        avatar: "https://i.pravatar.cc/150?img=1",
        lastMessage: "Bro that edit was fire 🔥🔥",
        timeAgo: "2m",
        unread: true,
        unreadCount: 3,
        isOnline: true,
        hasStory: true,
    },
    {
        id: "2",
        username: "emma.rose.x",
        fullName: "Emma Rose",
        avatar: "https://i.pravatar.cc/150?img=3",
        lastMessage: "Can you make a reel for me? 📸",
        timeAgo: "5m",
        unread: true,
        unreadCount: 1,
        isOnline: true,
        hasStory: true,
    },
    {
        id: "3",
        username: "tyler_wilson",
        fullName: "Tyler Wilson",
        avatar: "https://i.pravatar.cc/150?img=5",
        lastMessage: "Sent you the collab details ✉️",
        timeAgo: "12m",
        unread: true,
        unreadCount: 2,
        isOnline: false,
    },
    {
        id: "4",
        username: "olivia.grace",
        fullName: "Olivia Grace",
        avatar: "https://i.pravatar.cc/150?img=7",
        lastMessage: "That's so cool! 😍",
        timeAgo: "25m",
        isOnline: true,
        isSentByYou: true,
        hasStory: true,
    },
    {
        id: "5",
        username: "_noah.james_",
        fullName: "Noah James",
        avatar: "https://i.pravatar.cc/150?img=9",
        lastMessage: "Let's meet up tomorrow 🤙",
        timeAgo: "1h",
        isOnline: false,
        unread: true,
        unreadCount: 1,
    },
    {
        id: "6",
        username: "harry.styles.fan",
        fullName: "Harry Fan Account",
        avatar: "https://i.pravatar.cc/150?img=11",
        lastMessage: "Thanks for the follow! 💜",
        timeAgo: "1h",
        isOnline: false,
        hasStory: true,
    },
    {
        id: "7",
        username: "chloe__uk",
        fullName: "Chloe UK",
        avatar: "https://i.pravatar.cc/150?img=13",
        lastMessage: "Loved your latest post ❤️",
        timeAgo: "2h",
        isOnline: true,
        isVerified: false,
        isSentByYou: true,
    },
    {
        id: "8",
        username: "liam.carter",
        fullName: "Liam Carter",
        avatar: "https://i.pravatar.cc/150?img=15",
        lastMessage: "Bhai editing kaise seekhi? 🎬",
        timeAgo: "2h",
        isOnline: false,
        unread: true,
        unreadCount: 5,
    },
    {
        id: "9",
        username: "mason.reed",
        fullName: "Mason Reed",
        avatar: "https://i.pravatar.cc/150?img=17",
        lastMessage: "Check this out 👀",
        timeAgo: "3h",
        isOnline: false,
    },
    {
        id: "10",
        username: "sophia.blake",
        fullName: "Sophia Blake",
        avatar: "https://i.pravatar.cc/150?img=19",
        lastMessage: "You replied to their story",
        timeAgo: "3h",
        isOnline: true,
        isVerified: true,
        isSentByYou: true,
        hasStory: true,
    },
    {
        id: "11",
        username: "_ethan.cole_",
        fullName: "Ethan Cole",
        avatar: "https://i.pravatar.cc/150?img=21",
        lastMessage: "🔥🔥🔥",
        timeAgo: "4h",
        isOnline: false,
    },
    {
        id: "12",
        username: "charlotte.uk",
        fullName: "Charlotte UK",
        avatar: "https://i.pravatar.cc/150?img=23",
        lastMessage: "When's the next edit dropping?",
        timeAgo: "5h",
        isOnline: false,
        unread: true,
        unreadCount: 1,
    },
    {
        id: "13",
        username: "logan.x",
        fullName: "Logan X",
        avatar: "https://i.pravatar.cc/150?img=25",
        lastMessage: "That transition was insane 🤯",
        timeAgo: "5h",
        isOnline: true,
        hasStory: true,
    },
    {
        id: "14",
        username: "amelia_edits",
        fullName: "Amelia Edits",
        avatar: "https://i.pravatar.cc/150?img=27",
        lastMessage: "Sent you a reel",
        timeAgo: "6h",
        isOnline: false,
        isSentByYou: true,
    },
    {
        id: "15",
        username: "ryan_07",
        fullName: "Ryan 07",
        avatar: "https://i.pravatar.cc/150?img=29",
        lastMessage: "GG bro 💪",
        timeAgo: "7h",
        isOnline: false,
        isVerified: true,
    },
    {
        id: "16",
        username: "priya_sharma",
        fullName: "Priya Sharma",
        avatar: "https://i.pravatar.cc/150?img=32",
        lastMessage: "Collab karein? 🤝",
        timeAgo: "8h",
        isOnline: true,
        unread: true,
        unreadCount: 2,
    },
    {
        id: "17",
        username: "rahul_tech",
        fullName: "Rahul Tech",
        avatar: "https://i.pravatar.cc/150?img=60",
        lastMessage: "New phone review is up! Check it 📱",
        timeAgo: "9h",
        isOnline: false,
        isVerified: true,
        isSentByYou: true,
    },
    {
        id: "18",
        username: "ananya.vibes",
        fullName: "Ananya Vibes",
        avatar: "https://i.pravatar.cc/150?img=44",
        lastMessage: "Haha that meme was gold 😂😂",
        timeAgo: "10h",
        isOnline: false,
        hasStory: true,
    },
    {
        id: "19",
        username: "dark_edits_",
        fullName: "Dark Edits",
        avatar: "https://i.pravatar.cc/150?img=56",
        lastMessage: "Tutorial kab upload karoge?",
        timeAgo: "11h",
        isOnline: false,
        unread: true,
        unreadCount: 1,
    },
    {
        id: "20",
        username: "vibes.only",
        fullName: "Vibes Only",
        avatar: "https://i.pravatar.cc/150?img=38",
        lastMessage: "Caption idea: 'Built different' 💀",
        timeAgo: "12h",
        isOnline: true,
    },
    {
        id: "21",
        username: "creators_hub",
        fullName: "Creators Hub",
        avatar: "https://i.pravatar.cc/150?img=40",
        lastMessage: "Welcome to the group! 🎉",
        timeAgo: "1d",
        isOnline: false,
        isGroup: true,
        groupMembers: 156,
    },
    {
        id: "22",
        username: "music.lover_",
        fullName: "Music Lover",
        avatar: "https://i.pravatar.cc/150?img=42",
        lastMessage: "This song goes hard 🎵",
        timeAgo: "1d",
        isOnline: false,
        hasStory: true,
    },
    {
        id: "23",
        username: "fitness_king",
        fullName: "Fitness King",
        avatar: "https://i.pravatar.cc/150?img=50",
        lastMessage: "Bro gym chalein? 💪",
        timeAgo: "1d",
        isOnline: false,
    },
    {
        id: "24",
        username: "travel.diary_",
        fullName: "Travel Diary",
        avatar: "https://i.pravatar.cc/150?img=48",
        lastMessage: "Goa trip plan kar rahe hain 🏖️",
        timeAgo: "2d",
        isOnline: false,
        isSentByYou: true,
    },
];

// Device-based seeded shuffle
const getDeviceSeed = () => {
    const ua = navigator.userAgent || '';
    const screen = `${window.screen.width}x${window.screen.height}`;
    let hash = 0;
    const str = ua + screen + (navigator.language || '');
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
    const shuffled = [...arr];
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const j = s % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Online friends shown at top
const onlineFriends = mockChats.filter((c) => c.isOnline).slice(0, 8);

const MessagesScreen = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"primary" | "general">("primary");

    const userAccount = mockAccounts["just4abhii"];
    const username = userAccount?.profile?.username || currentUser.username;

    // Shuffle chats per device so each device shows different order
    const shuffledChats = useMemo(() => seededShuffle(mockChats, getDeviceSeed()), []);

    const filteredChats = searchQuery
        ? shuffledChats.filter(
            (c) =>
                c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.fullName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : shuffledChats;

    return (
        <div className="pb-16 min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background">
                <div className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/")}
                            className="text-foreground active:scale-90 transition-transform"
                        >
                            <ChevronLeft size={28} strokeWidth={1.8} />
                        </button>
                        <div className="flex items-center gap-1.5">
                            <h1 className="text-[22px] font-bold text-foreground">
                                {username}
                            </h1>
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className="text-foreground mt-0.5"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-foreground active:scale-90 transition-transform">
                            <Edit size={24} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-2">
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ask Meta AI or Search"
                            className="w-full h-[36px] rounded-[10px] bg-secondary pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
                        />
                    </div>
                </div>
            </header>

            {/* Online friends row */}
            {!searchQuery && (
                <div className="px-2 pb-2">
                    <div className="flex gap-3 overflow-x-auto hide-scrollbar py-2 px-2">
                        {onlineFriends.map((friend) => (
                            <button
                                key={friend.id}
                                className="flex flex-col items-center gap-1 min-w-[64px]"
                            >
                                <div className="relative">
                                    <div
                                        className={cn(
                                            "rounded-full p-[2px]",
                                            friend.hasStory
                                                ? "story-ring"
                                                : "border-transparent"
                                        )}
                                    >
                                        <div className="rounded-full bg-background p-[1.5px]">
                                            <img
                                                src={friend.avatar}
                                                alt={friend.username}
                                                className="h-[56px] w-[56px] rounded-full object-cover"
                                            />
                                        </div>
                                    </div>
                                    {/* Green online dot */}
                                    <div className="absolute bottom-1 right-1 h-[14px] w-[14px] rounded-full bg-[#44b700] border-[2.5px] border-background" />
                                </div>
                                <span className="text-[11px] text-foreground w-[64px] truncate text-center">
                                    {friend.username.length > 10
                                        ? friend.username.slice(0, 9) + "..."
                                        : friend.username}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Primary / General tabs */}
            {!searchQuery && (
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab("primary")}
                        className={cn(
                            "flex-1 py-3 text-[14px] font-semibold text-center relative transition-colors",
                            activeTab === "primary"
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        Primary
                        {activeTab === "primary" && (
                            <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("general")}
                        className={cn(
                            "flex-1 py-3 text-[14px] font-semibold text-center relative transition-colors",
                            activeTab === "general"
                                ? "text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        General
                        {activeTab === "general" && (
                            <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-foreground" />
                        )}
                    </button>
                </div>
            )}

            {/* Chat list */}
            <div className="divide-y-0">
                {filteredChats.map((chat, index) => (
                    <button
                        key={chat.id}
                        className="flex items-center gap-3 w-full px-4 py-2.5 active:bg-secondary/50 transition-colors text-left"
                    >
                        {/* Avatar with online indicator */}
                        <div className="relative flex-shrink-0">
                            <div
                                className={cn(
                                    "rounded-full p-[2px]",
                                    chat.hasStory ? "story-ring" : ""
                                )}
                            >
                                <div className="rounded-full bg-background p-[1px]">
                                    <img
                                        src={chat.avatar}
                                        alt={chat.username}
                                        className="h-[54px] w-[54px] rounded-full object-cover"
                                    />
                                </div>
                            </div>
                            {chat.isOnline && (
                                <div className="absolute bottom-1 right-1 h-[14px] w-[14px] rounded-full bg-[#44b700] border-[2.5px] border-background" />
                            )}
                        </div>

                        {/* Chat info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <span
                                    className={cn(
                                        "text-[14px] truncate",
                                        chat.unread
                                            ? "font-bold text-foreground"
                                            : "font-normal text-foreground"
                                    )}
                                >
                                    {chat.fullName}
                                </span>
                                {chat.isVerified && (
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        className="flex-shrink-0"
                                    >
                                        <path
                                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                            fill="hsl(var(--ig-blue))"
                                            stroke="none"
                                        />
                                        <path
                                            d="M9 12l2 2 4-4"
                                            fill="none"
                                            stroke="white"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                <p
                                    className={cn(
                                        "text-[13px] truncate",
                                        chat.unread
                                            ? "text-foreground font-medium"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {chat.isSentByYou ? "You: " : ""}
                                    {chat.isTyping ? (
                                        <span className="text-[hsl(var(--ig-blue))]">
                                            typing...
                                        </span>
                                    ) : (
                                        chat.lastMessage
                                    )}
                                </p>
                                <span className="text-[13px] text-muted-foreground flex-shrink-0">
                                    · {chat.timeAgo}
                                </span>
                            </div>
                        </div>

                        {/* Right side - unread badge or camera */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                            {chat.unread && chat.unreadCount ? (
                                <div className="h-[20px] min-w-[20px] rounded-full bg-[hsl(var(--ig-blue))] flex items-center justify-center px-1">
                                    <span className="text-[11px] font-bold text-white">
                                        {chat.unreadCount}
                                    </span>
                                </div>
                            ) : (
                                <Camera
                                    size={22}
                                    className="text-muted-foreground/50"
                                    strokeWidth={1.5}
                                />
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MessagesScreen;
