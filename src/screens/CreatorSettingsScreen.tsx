import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const menuItems = [
  "Gifts",
  "Subscriptions",
  "Ads payments",
  "Branded content",
  "Partnership ads",
  "Link profile to shops",
  "Saved replies",
  { label: "Frequently asked questions", right: "Off" },
  "Welcome message",
  "Minimum age",
  "Monetisation status",
  "Crossposting",
  "View counts on profile",
  "Switch account type",
  "Add new professional account",
  "Request verification",
  "Appointment requests",
];

const CreatorSettingsScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-4 px-4 h-[48px] bg-background border-b border-border/20">
        <button onClick={() => navigate('/analytics')} className="text-foreground">
          <ArrowLeft size={24} strokeWidth={2} />
        </button>
        <h1 className="text-[17px] font-bold">Creator</h1>
      </header>

      {/* Menu List */}
      <div className="px-4">
        {menuItems.map((item, i) => {
          const label = typeof item === "string" ? item : item.label;
          const right = typeof item === "object" ? item.right : null;
          return (
            <div
              key={i}
              className="flex items-center justify-between py-[14px] border-b border-border/10 last:border-b-0"
            >
              <span className="text-[15px] text-foreground">{label}</span>
              {right && (
                <span className="text-[14px] text-muted-foreground">{right}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CreatorSettingsScreen;
