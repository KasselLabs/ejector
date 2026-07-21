"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OTHER_INTRO_CREATORS,
  KASSEL_LABS_URL,
  type IntroCreatorLink,
} from "@/lib/introCreators";

const APP = "among-us-ejector";
const HELP_URL = `https://kassellabs.io/help/${APP}/`;
const TOS_URL = `${HELP_URL}#termsOfService`;

interface NavbarProps {
  /** Other intro creators to show in the MORE APPS dropdown. Defaults to the
   *  hardcoded fallback list when omitted. Pass the result of
   *  `fetchIntroCreators()` from the parent Server Component for a live list. */
  creators?: IntroCreatorLink[];
}

export function Navbar({ creators = OTHER_INTRO_CREATORS }: NavbarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const isHome = pathname === "/";

  return (
    <nav className="kl-navbar">
      <div className="kl-navbar__content">
        <a
          href="https://kassellabs.io"
          target="_blank"
          rel="noopener noreferrer"
          className="kl-navbar__logo"
          aria-label="Kassel Labs"
        >
          <Image
            src="/kassel-labs-logo.png"
            alt="Kassel Labs"
            height={20}
            width={160}
            priority
          />
        </a>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          className="kl-navbar__hamburger"
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>

        <NavbarMenu
          className="kl-navbar__menu kl-navbar__menu--desktop"
          isHome={isHome}
          creators={creators}
        />
      </div>

      {isMobileMenuOpen && (
        <NavbarMenu
          className="kl-navbar__menu kl-navbar__menu--mobile"
          isHome={isHome}
          onItemClick={() => setIsMobileMenuOpen(false)}
          creators={creators}
        />
      )}

      <style>{`
        .kl-navbar {
          position: relative;
          background-color: #141414;
          font-family: var(--font-roboto), 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 14px;
          letter-spacing: 0.04em;
          z-index: 50;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .kl-navbar__content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          min-height: 50px;
        }
        .kl-navbar__logo {
          display: flex;
          align-items: center;
          margin: 13px 0;
        }
        .kl-navbar__hamburger {
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          width: 36px;
          height: 36px;
          padding: 7px;
          background: transparent;
          border: 0;
          cursor: pointer;
        }
        .kl-navbar__hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          border-radius: 1px;
          background-color: #fff;
        }
        .kl-navbar__menu {
          margin: 0;
          padding: 0;
          list-style-type: none;
        }
        .kl-navbar__menu--desktop {
          display: none;
        }
        .kl-navbar__menu li {
          position: relative;
          display: inline-block;
        }
        .kl-navbar__menu a {
          display: block;
          min-width: 130px;
          padding: 0 18px;
          height: 50px;
          line-height: 50px;
          color: #fff !important;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          background: transparent;
        }
        .kl-navbar__menu a:hover {
          background: #2f3036;
        }
        .kl-navbar__menu a.is-active {
          color: #fff !important;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 -2px 0 #fff;
        }
        .kl-navbar__menu .kl-navbar__dropdown {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          margin: 0;
          padding: 0;
          list-style-type: none;
          background: #232429;
          z-index: 60;
          min-width: 220px;
        }
        .kl-navbar__menu li:hover > .kl-navbar__dropdown,
        .kl-navbar__menu .kl-navbar__dropdown:hover {
          display: block;
        }
        .kl-navbar__menu .kl-navbar__dropdown a {
          height: 40px;
          line-height: 40px;
          background: #232429;
          text-align: left;
        }
        .kl-navbar__menu .kl-navbar__dropdown a:hover {
          background: #2f3036;
        }
        /* The right-most menu item (MORE APPS) sits at the navbar's right
           edge; a left-anchored dropdown would spill past the viewport and add
           a horizontal scrollbar on hover. Anchor it to the item's right edge
           so it opens leftward and stays on-screen. */
        .kl-navbar__menu--desktop li:last-child > .kl-navbar__dropdown {
          left: auto;
          right: 0;
        }

        .kl-navbar__menu--mobile {
          display: block;
          background: #1b1b1b;
          padding: 6px 0;
        }
        .kl-navbar__menu--mobile li {
          display: block;
          width: 100%;
        }
        .kl-navbar__menu--mobile a {
          width: 100%;
          text-align: left;
          padding-left: 20px;
        }
        .kl-navbar__menu--mobile .kl-navbar__dropdown {
          position: static;
          display: block;
          background: transparent;
          padding-left: 18px;
        }
        .kl-navbar__menu--mobile .kl-navbar__dropdown a {
          background: transparent;
        }

        @media (min-width: 768px) {
          .kl-navbar__hamburger { display: none; }
          .kl-navbar__menu--desktop { display: flex; }
          .kl-navbar__menu--mobile { display: none; }
        }
      `}</style>
    </nav>
  );
}

interface NavbarMenuProps {
  className?: string;
  onItemClick?: () => void;
  isHome?: boolean;
  creators?: IntroCreatorLink[];
}

function NavbarMenu({
  className,
  onItemClick,
  isHome,
  creators = OTHER_INTRO_CREATORS,
}: NavbarMenuProps) {
  return (
    <ul className={className}>
      <li>
        <Link
          href="/"
          onClick={onItemClick}
          aria-current={isHome ? "page" : undefined}
          className={isHome ? "is-active" : undefined}
        >
          HOME
        </Link>
      </li>
      <li>
        <a
          href={HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onItemClick}
        >
          CONTACT
        </a>
      </li>
      <li>
        {/* keyboard-focus-friendly trigger; the visual dropdown opens on hover */}
        <a tabIndex={0}>HELP</a>
        <ul className="kl-navbar__dropdown">
          <li>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onItemClick}
            >
              FAQ
            </a>
          </li>
          <li>
            <a
              href={TOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onItemClick}
            >
              TERMS OF SERVICE
            </a>
          </li>
          <li>
            <a
              href="https://kassellabs.io/help/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onItemClick}
            >
              PRIVACY POLICY
            </a>
          </li>
          <li>
            <a
              href="https://kassellabs.io/about"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onItemClick}
            >
              ABOUT US
            </a>
          </li>
        </ul>
      </li>
      <li>
        {/* keyboard-focus-friendly trigger; the visual dropdown opens on hover */}
        <a tabIndex={0}>MORE APPS</a>
        <ul className="kl-navbar__dropdown">
          {creators.map((creator) => (
            <li key={creator.href}>
              <a
                href={creator.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onItemClick}
              >
                {creator.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={KASSEL_LABS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onItemClick}
            >
              SEE ALL
            </a>
          </li>
        </ul>
      </li>
    </ul>
  );
}
