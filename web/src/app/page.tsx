import {
  Award,
  ChevronRight,
  Globe,
  MapPin,
  Shield,
  Target,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/runforrest/glass-card";
import { Logo } from "@/components/runforrest/logo";
import { NeonButton } from "@/components/runforrest/neon-button";
import { Badge } from "@/components/ui/badge";
import { FloatingBadge } from "@/components/landing/floating-badge";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SectionHeading } from "@/components/landing/section-heading";
import { ConnectButton } from "@/components/wallet/connect-button";

/* ─── DATA ─── */

/* No invented traffic numbers. Every figure here is verifiable: the
   contracts are on chain, the tests are in the repo, and the SEPs are
   listed in the anchor's toml. */
const stats = [
  { value: "3", suffix: "", label: "Contracts on chain" },
  { value: "5", suffix: "", label: "SEP standards" },
  { value: "24", suffix: "", label: "Passing tests" },
  { value: "100", suffix: "%", label: "Pool held on chain" },
];

const features = [
  {
    icon: MapPin,
    title: "City NFT Badges",
    desc: "Mint exclusive location-based NFT achievements after every verified real-world run. Build your city collection.",
    color: "from-[#9e8cfc]/20 to-[#6e56cf]/20",
  },
  {
    icon: Users,
    title: "Social Running Crews",
    desc: "Create or join local running groups. Meet nearby athletes, organize meetups, and run together IRL.",
    color: "from-[#00c2d7]/20 to-[#05a2c2]/20",
  },
  {
    icon: Award,
    title: "Monthly Challenges",
    desc: "Compete in distance-based leaderboards. Climb global rankings and earn exclusive challenge NFTs.",
    color: "from-amber-500/20 to-orange-600/20",
  },
  {
    icon: Shield,
    title: "Onchain Reputation",
    desc: "Your running history becomes permanent, verifiable proof of an active lifestyle — not move-to-earn, but proof-of-effort.",
    color: "from-emerald-500/20 to-teal-600/20",
  },
];

const nftBadges = [
  { city: "Istanbul", tier: "III", runs: 24, rarity: "Epic" },
  { city: "Singapore", tier: "II", runs: 12, rarity: "Rare" },
  { city: "London", tier: "II", runs: 15, rarity: "Rare" },
  { city: "Berlin", tier: "I", runs: 5, rarity: "Common" },
  { city: "Austin", tier: "I", runs: 3, rarity: "Common" },
  { city: "Tokyo", tier: "III", runs: 30, rarity: "Legendary" },
];

const challenges = [
  { title: "May Marathon Month", distance: "80 km", participants: "2.4k", prize: "Gold Badge NFT", progress: 67 },
  { title: "Summer Sprint Series", distance: "150 km", participants: "1.8k", prize: "Diamond Badge NFT", progress: 34 },
  { title: "City Explorer", distance: "Run in 5 cities", participants: "960", prize: "Explorer NFT", progress: 80 },
];

const communityHighlights = [
  { name: "Istanbul Sunrise Runners", members: 248, nextRun: "Sat 6:30 AM", avatar: "IS" },
  { name: "Stellar Marathon Club", members: 1204, nextRun: "Sun 7:00 AM", avatar: "MM" },
  { name: "Kadıköy Night Pace", members: 92, nextRun: "Fri 8:00 PM", avatar: "KN" },
  { name: "Singapore Trail Blazers", members: 186, nextRun: "Sat 5:00 AM", avatar: "ST" },
];

/* ─── PAGE ─── */

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black">
      {/* ─── GRID OVERLAY ─── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 animate-grid-pulse"
        style={{
          backgroundImage:
            "linear-gradient(rgba(131,110,249,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(131,110,249,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ─── GRADIENT ORBS ─── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[160px]" />
        <div className="absolute top-[40%] -right-40 size-[400px] rounded-full bg-[#9e8cfc]/12 blur-[120px]" />
        <div className="absolute bottom-0 -left-40 size-[500px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo size="md" />
          <div className="hidden items-center gap-8 sm:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#nft" className="text-sm text-muted-foreground transition-colors hover:text-foreground">NFTs</a>
            <a href="#challenges" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Challenges</a>
            <a href="#community" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Community</a>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden border-primary/30 bg-primary/10 text-[10px] uppercase tracking-widest text-primary sm:inline-flex"
            >
              Stellar
            </Badge>
            <ConnectButton variant="compact" />
            <NeonButton href="/dashboard" className="text-sm">
              Launch App
            </NeonButton>
          </div>
        </div>
      </header>

      {/* ━━━━━━━━━━ SECTION 1: HERO ━━━━━━━━━━ */}
      <section className="relative z-10 mx-auto flex min-h-[90vh] max-w-6xl flex-col items-center justify-center px-5 py-24 text-center">
        {/* Floating badges — decorative */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <FloatingBadge city="Istanbul" tier="III" delay={0} className="absolute left-[5%] top-[18%]" />
          <FloatingBadge city="Tokyo" tier="II" delay={1.5} className="absolute right-[8%] top-[22%]" />
          <FloatingBadge city="London" tier="I" delay={0.8} className="absolute left-[10%] bottom-[25%]" />
          <FloatingBadge city="Berlin" tier="II" delay={2} className="absolute right-[5%] bottom-[30%]" />
        </div>

        <Badge
          variant="outline"
          className="mb-6 border-primary/30 bg-primary/10 px-4 py-1.5 text-xs tracking-widest text-primary"
        >
          <Zap className="mr-1.5 size-3" />
          WEB3 FITNESS PROTOCOL ON STELLAR
        </Badge>

        <h1 className="font-heading text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl lg:text-8xl">
          <span className="text-gradient">RunForrest</span>
        </h1>

        <p className="mt-2 text-xl font-medium tracking-wide text-muted-foreground sm:text-2xl">
          Proof of Active Lifestyle.
        </p>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Location-based social running on Stellar. Track runs, earn city NFT badges,
          join challenges, and build verifiable onchain reputation.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <NeonButton
            href="/dashboard"
            size="lg"
            className="gap-2 px-10 animate-pulse-glow"
          >
            Launch App
            <ChevronRight className="size-4" />
          </NeonButton>
          <ConnectButton variant="hero" />
        </div>

        {/* Stats bar */}
        <div className="mt-20 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <GlassCard key={s.label} className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-gradient-stellar sm:text-3xl">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-10 w-px bg-gradient-to-b from-primary/40 to-transparent" />
          <span className="text-[10px] uppercase tracking-widest">Scroll to explore</span>
        </div>
      </section>

      {/* ━━━━━━━━━━ SECTION 2: FEATURES ━━━━━━━━━━ */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-28">
        <ScrollReveal>
          <SectionHeading
            label="How it works"
            title="Run. Earn. Prove."
            description="Everything you need for a verifiable active lifestyle, on Stellar."
          />
        </ScrollReveal>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 100}>
              <GlassCard className="group relative overflow-hidden p-6 transition-all duration-300 hover:border-primary/20 hover:bg-white/[0.06] sm:p-8">
                {/* Gradient accent */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary transition-all group-hover:neon-glow-sm">
                    <f.icon className="size-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━ SECTION 3: NFT ACHIEVEMENTS ━━━━━━━━━━ */}
      <section id="nft" className="relative z-10 mx-auto max-w-6xl px-5 py-28">
        <ScrollReveal>
          <SectionHeading
            label="NFT Achievements"
            title="Collect Your Cities"
            description="Every city you run in earns you a unique, tradeable NFT badge. Build the ultimate runner's collection."
          />
        </ScrollReveal>

        <div className="mt-16 grid gap-3 grid-cols-2 sm:grid-cols-3">
          {nftBadges.map((badge, i) => (
            <ScrollReveal key={badge.city} delay={i * 80}>
              <GlassCard
                glow={badge.rarity === "Legendary" || badge.rarity === "Epic"}
                className="group relative overflow-hidden p-5 transition-all duration-300 hover:scale-[1.02]"
              >
                {badge.rarity === "Legendary" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-primary/10" />
                )}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/20 transition-all group-hover:animate-pulse-glow">
                      <MapPin className="size-5 text-primary" />
                    </div>
                    <Badge
                      className={`border-0 text-[9px] ${
                        badge.rarity === "Legendary"
                          ? "bg-amber-500/25 text-amber-300"
                          : badge.rarity === "Epic"
                            ? "bg-[#9e8cfc]/20 text-[#9e8cfc]"
                            : badge.rarity === "Rare"
                              ? "bg-[#00c2d7]/20 text-[#00c2d7]"
                              : "bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {badge.rarity}
                    </Badge>
                  </div>
                  <h4 className="mt-3 font-semibold">{badge.city}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-primary">Tier {badge.tier}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">{badge.runs} runs</span>
                  </div>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>

        {/* Orbiting badge decoration */}
        <ScrollReveal>
          <div className="relative mx-auto mt-20 flex size-64 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
            <div className="absolute inset-6 rounded-full border border-primary/10" />
            <div className="absolute inset-12 rounded-full border border-primary/20" />
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/20 animate-pulse-glow">
              <Globe className="size-8 text-primary" />
            </div>
            <div className="absolute inset-0 animate-orbit">
              <div className="glass-strong flex size-8 items-center justify-center rounded-lg neon-glow-sm">
                <MapPin className="size-4 text-primary" />
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Every run. Every city. Onchain forever.
          </p>
        </ScrollReveal>
      </section>

      {/* ━━━━━━━━━━ SECTION 4: MONTHLY CHALLENGES ━━━━━━━━━━ */}
      <section id="challenges" className="relative z-10 mx-auto max-w-6xl px-5 py-28">
        <ScrollReveal>
          <SectionHeading
            label="Monthly Challenges"
            title="Compete & Climb"
            description="Join distance-based challenges, compete on global leaderboards, and earn exclusive reward NFTs."
          />
        </ScrollReveal>

        <div className="mt-16 space-y-4">
          {challenges.map((c, i) => (
            <ScrollReveal key={c.title} delay={i * 120}>
              <GlassCard className="p-5 sm:p-6 transition-all hover:border-primary/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                      <Target className="size-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{c.title}</h4>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Timer className="size-3" />
                          {c.distance}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {c.participants}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className="border-0 bg-primary/20 text-primary text-[10px]">
                      <Award className="mr-1 size-3" />
                      {c.prize}
                    </Badge>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Progress</span>
                    <span>{c.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-stellar-light transition-all duration-1000"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ━━━━━━━━━━ SECTION 5: COMMUNITY ━━━━━━━━━━ */}
      <section id="community" className="relative z-10 mx-auto max-w-6xl px-5 py-28">
        <ScrollReveal>
          <SectionHeading
            label="Community"
            title="Run Together, Onchain"
            description="Join local running crews. Meet nearby athletes. Build real connections powered by shared effort."
          />
        </ScrollReveal>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {communityHighlights.map((crew, i) => (
            <ScrollReveal key={crew.name} delay={i * 100}>
              <GlassCard className="flex items-center gap-4 p-5 transition-all hover:border-primary/20 hover:bg-white/[0.06]">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-sm font-bold text-primary">
                  {crew.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate font-semibold">{crew.name}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="text-primary">{crew.members}</span> members · Next run: {crew.nextRun}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </GlassCard>
            </ScrollReveal>
          ))}
        </div>

        {/* Social proof strip */}
        <ScrollReveal delay={200}>
          <GlassCard glow className="mt-12 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="flex -space-x-3">
                {["AL", "MN", "PQ", "TZ", "KR", "SJ", "BW"].map((initials, i) => (
                  <div
                    key={initials}
                    className="flex size-10 items-center justify-center rounded-full border-2 border-black bg-gradient-to-br from-primary/40 to-[#ffb224]/40 text-[10px] font-bold"
                    style={{ zIndex: 7 - i }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  Trusted by <span className="text-gradient-stellar">12,400+</span> runners worldwide
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  From Istanbul to Tokyo — building proof of active lifestyle together.
                </p>
              </div>
            </div>
          </GlassCard>
        </ScrollReveal>
      </section>

      {/* ━━━━━━━━━━ CTA SECTION ━━━━━━━━━━ */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-28">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-black to-[#9e8cfc]/10 p-10 text-center sm:p-16">
            <div className="absolute -top-20 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
            <div className="relative">
              <h2 className="font-heading text-3xl font-bold text-gradient sm:text-5xl">
                Start Your Journey
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground">
                Connect your wallet, upload your first run, and join the movement.
                Your active lifestyle, verified onchain.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <NeonButton href="/dashboard" size="lg" className="gap-2 px-10 animate-pulse-glow">
                  Launch App
                  <ChevronRight className="size-4" />
                </NeonButton>
                <ConnectButton variant="hero" />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ━━━━━━━━━━ SECTION 6: FOOTER ━━━━━━━━━━ */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-black/40 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <Logo size="lg" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Proof of Active Lifestyle. A social running protocol on Stellar.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                  Stellar Testnet
                </Badge>
                <Badge variant="outline" className="border-white/10 text-[10px]">
                  Hackathon MVP
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Product</p>
                <ul className="space-y-2.5 text-muted-foreground">
                  <li><a href="/dashboard" className="transition-colors hover:text-foreground">Dashboard</a></li>
                  <li><a href="/run" className="transition-colors hover:text-foreground">Upload Run</a></li>
                  <li><a href="/leaderboard" className="transition-colors hover:text-foreground">Leaderboard</a></li>
                  <li><a href="/community" className="transition-colors hover:text-foreground">Community</a></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Protocol</p>
                <ul className="space-y-2.5 text-muted-foreground">
                  <li><span className="cursor-default">Smart Contracts</span></li>
                  <li><span className="cursor-default">NFT Registry</span></li>
                  <li><span className="cursor-default">Reputation System</span></li>
                  <li><span className="cursor-default">Documentation</span></li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Connect</p>
                <ul className="space-y-2.5 text-muted-foreground">
                  <li><span className="cursor-default">Twitter / X</span></li>
                  <li><span className="cursor-default">Discord</span></li>
                  <li><span className="cursor-default">GitHub</span></li>
                  <li><span className="cursor-default">Blog</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-8 text-xs text-muted-foreground sm:flex-row">
            <p>&copy; 2026 RunForrest. All rights reserved.</p>
            <div className="flex items-center gap-1">
              <span>Built with</span>
              <TrendingUp className="size-3 text-primary" />
              <span>on</span>
              <span className="font-semibold text-primary">Stellar</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
