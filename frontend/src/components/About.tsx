import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { Heart, Award, Users } from "lucide-react";

// --- 1. DEFINE THE NEW 3D FLIP ANIMATION VARIANTS ---
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2, // This creates the sequential animation
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    rotateY: -90 // Start with the card turned 90 degrees on its side
  },
  visible: {
    opacity: 1,
    rotateY: 0, // Animate to a flat, forward-facing position
    transition: {
      duration: 0.6,
      ease: "easeOut" as const,
    }
  },
};
// --------------------------------------------------

const About = () => {
  const values = [
    {
      icon: Heart,
      title: "Passion for Quality",
      description: "Every piece is carefully selected to ensure the highest quality and craftsmanship.",
    },
    {
      icon: Award,
      title: "Traditional Excellence",
      description: "Preserving centuries-old weaving traditions and supporting local artisans.",
    },
    {
      icon: Users,
      title: "Customer First",
      description: "Building lasting relationships through trust, quality, and exceptional service.",
    },
  ];

  return (
    <AnimatedSection id="about">
      <div className="container mx-auto px-4">
        <div className="animated-border-advanced p-8 md:p-12 bg-white/50 backdrop-blur-xl rounded-2xl shadow-elegant">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-gray-900">
              About <span className="text-gradient-silk">Raju Electricals</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              For generations, we have been dedicated to bringing the finest
              Indian textiles to our customers, blending traditional
              craftsmanship with contemporary designs.
            </p>
          </div>

          {/* --- 2. APPLY THE VARIANTS & PERSPECTIVE --- */}
          <motion.div
            className="grid md:grid-cols-3 gap-10"
            style={{ perspective: 1000 }} // This is required for 3D transforms to look correct
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={index}
                  variants={cardVariants} // Each card gets the new 3D flip variant
                  className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-xl shadow-soft hover:shadow-elegant transition-shadow duration-300 border border-white/50"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-silk mb-5 shadow-md animate-float">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold mb-3 text-gray-800">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
          {/* ------------------------------------------- */}

        </div>
      </div>
    </AnimatedSection>
  );
};

export default About;