import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { Phone, Mail, MapPin, Facebook, Instagram, Youtube, Star } from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.25,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 20
    },
  },
};

const floatAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 2.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const Contact = () => {
  const contactDetails = [
    {
      icon: Phone,
      title: "Phone",
      details: ["+91 9344155310"],
      buttonText: "Call Now",
      buttonLink: "tel:+919344155310",
    },
    {
      icon: Mail,
      title: "Email",
      details: ["contact@tgopitextiles.com"],
      buttonText: "Email Us",
      buttonLink: "mailto:contact@tgopitextiles.com",
    },
    {
      icon: MapPin,
      title: "Location",
      details: ["Raju Electricals", "48-C, AALADI PILLAYAR KOVIL STREET, KANCHIPURAM - 631 501"],
      buttonText: "Get Directions",
      buttonLink: "https://www.google.com/maps/place/48-C,+Aaladi+Pillayar+Kovil+Street,+Keeraimandapam,+Kanchipuram,+Tamil+Nadu+631501",
    },
  ];

  const socialLinks = [
    { icon: Facebook, href: "#", name: "Facebook" },
    { icon: Instagram, href: "#", name: "Instagram" },
    { icon: Youtube, href: "#", name: "YouTube" },
    { icon: Star, href: "#", name: "Google Reviews" },
  ];


  return (
    <AnimatedSection id="contact">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="p-8 md:p-12 bg-white/50 backdrop-blur-xl rounded-2xl shadow-elegant border border-white/50"
        >
          <div className="text-center mb-16">
            <motion.h2
              className="text-4xl md:text-5xl font-serif font-bold mb-4 text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              Get in <span className="text-gradient-silk">Touch</span>
            </motion.h2>
            <motion.p
              className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Visit our store or reach out to us. We're here to help you find
              the perfect textile.
            </motion.p>
          </div>

          <motion.div
            className="grid md:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {/* --- THIS IS THE SECTION FROM YOUR IMAGE --- */}
            {contactDetails.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  variants={cardVariants}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  transition={{ type: "spring" as const, stiffness: 150 }}
                  className="shine-effect flex flex-col items-center p-8 text-center bg-white/60 backdrop-blur-sm rounded-xl shadow-soft hover:shadow-elegant transition-all duration-300 border border-white/50"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <motion.div
                    animate={floatAnimation}
                    className="p-4 mb-4 text-white rounded-lg bg-gradient-silk shadow-md"
                    style={{ transform: "translateZ(20px)" }}
                  >
                    <Icon size={32} />
                  </motion.div>

                  <h3 className="mb-3 text-2xl font-serif font-bold text-gray-800">
                    {item.title}
                  </h3>

                  <div className="flex-grow text-gray-600 space-y-1">
                    {item.details.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>

                  <a
                    href={item.buttonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-8 py-3 mt-6 font-bold text-gray-800 transition-bounce bg-gradient-to-r from-yellow-300 to-orange-400 rounded-full hover:scale-105"
                  >
                    {item.buttonText}
                  </a>
                </motion.div>
              );
            })}
            {/* --- END OF THE SECTION --- */}
          </motion.div>

          <motion.div
            className="text-center mt-16 pt-10 border-t border-gray-300/50"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.8 }}
          >
            <h3 className="text-2xl font-serif font-bold text-gray-800 mb-6">
              Follow Us
            </h3>
            <div className="flex justify-center items-center gap-6 md:gap-8">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  title={social.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15, ease: "easeOut" }}
                  whileHover={{ scale: 1.2, color: "#d97706" }}
                  className="text-gray-600"
                >
                  <social.icon size={28} />
                </motion.a>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </AnimatedSection>
  );
};

export default Contact;