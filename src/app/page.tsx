import { HomePage } from "@/components/HomePage";
import { Navbar } from "@/components/Navbar";
import { MoreCreators } from "@/components/MoreCreators";
import { AboutSection } from "@/components/AboutSection";
import { fetchIntroCreators } from "@/lib/introCreators";

export default async function Page() {
  // Roster + preview clips from the admin (admin.kassellabs.io) GraphQL.
  // Cached server-side for 1 hour; falls back to the hardcoded list if
  // unavailable, so a failed fetch never breaks the page.
  const creators = await fetchIntroCreators();
  return (
    <>
      <Navbar creators={creators} />
      <HomePage />
      <MoreCreators creators={creators} />
      <AboutSection />
    </>
  );
}
