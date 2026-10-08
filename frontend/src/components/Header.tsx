import { useState, useEffect } from "react";
import { navLinks } from "@/constants";

interface HeaderProps {
  onLoginClick: () => void;
}

const Header = ({ onLoginClick }: HeaderProps) => {
  // 1. State for visibility (starts visible)
  const [isVisible, setIsVisible] = useState(true);
  // 2. State to store the last scroll position
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Logic to show/hide the header
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // If scrolling down AND past 100px, hide the header
        setIsVisible(false);
      } else {
        // If scrolling up or at the very top, show the header
        setIsVisible(true);
      }

      // Update the last scroll position for the next event
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]); // Re-run the effect when lastScrollY changes

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-10 
        bg-black/50 backdrop-blur-lg shadow-md
        transition-transform duration-300 ease-in-out
        ${isVisible ? "translate-y-0" : "-translate-y-full"}
      `}
    >
      <nav className="container flex items-center justify-between py-5">
        <div
          onClick={onLoginClick}
          className="text-2xl font-bold tracking-tighter cursor-pointer text-gradient-silk"
        >
          Raju Electricals
        </div>

        <ul className="hidden items-center gap-10 lg:flex">
          {navLinks.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                className="font-medium text-white transition-colors duration-300 hover:text-gradient-silk"
              >
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
};

export default Header;