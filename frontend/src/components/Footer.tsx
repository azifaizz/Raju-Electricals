import AnimatedSection from "./AnimatedSection";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const quickLinks = [
    { name: "Home", href: "#home" },
    { name: "About", href: "#about" },
    { name: "Our Story", href: "#story" },
    { name: "Collections", href: "#collections" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <AnimatedSection className="pt-0 pb-16">
      <div className="container mx-auto px-4">
        <div className="animated-border-advanced p-8 md:p-12 bg-white/50 backdrop-blur-xl rounded-2xl shadow-elegant">
          <div className="grid md:grid-cols-3 gap-12 mb-10">
            <div>
              <h3 className="text-3xl font-serif font-bold text-gradient-silk mb-4">
                Raju Electricals
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Premium traditional and contemporary textiles.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-bold mb-4 text-gray-800">
                Quick Links
              </h4>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-gray-600 hover:text-gradient-silk transition-smooth hover:translate-x-1 inline-block"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold mb-4 text-gray-800">
                Store Hours
              </h4>
              {/* --- MODIFIED: Store hours updated below --- */}
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                  Sunday - Saturday: 9:00 AM - 9:00 PM
                </li>
              </ul>
              <p className="mt-6 border-l-4 border-primary/50 pl-4 text-muted-foreground">
                Visit us in-store for personalized assistance and to see our
                complete collection.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-gray-500">
              &copy; Flipflex 2025
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default Footer;