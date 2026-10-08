import { useState, useEffect } from "react";
import slideshow1 from "@/assets/slideshow-1.jpg";
import slideshow2 from "@/assets/slideshow-2.jpg";
import slideshow3 from "@/assets/slideshow-3.jpg";
import slideshow4 from "@/assets/slideshow-4.jpg";
import slideshow5 from "@/assets/slideshow-5.jpg";
import slideshow6 from "@/assets/slideshow-6.jpg";
import slideshow7 from "@/assets/slideshow-7.jpg";
import { motion } from "framer-motion";

const Hero = () => {
  // --- THIS IS THE MODIFIED PART ---
  // The images array now includes all 7 imported images.
  const images = [
    slideshow1,
    slideshow2,
    slideshow3,
    slideshow4,
    slideshow5,
    slideshow6,
    slideshow7,
  ];
  // ---------------------------------

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 5000); // 5 seconds per image
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <section
      id="home"
      className="relative flex h-screen w-full items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 h-full w-full">
        {images.map((image, index) => (
          <motion.div
            key={index}
            className="absolute inset-0 h-full w-full"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{
              opacity: index === currentImageIndex ? 1 : 0,
              scale: index === currentImageIndex ? 1 : 1.1,
            }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          >
            <img
              src={image}
              alt={`Slideshow image ${index + 1}`}
              className="h-full w-full object-cover"
            />
          </motion.div>
        ))}
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="mb-6 font-serif text-4xl font-black leading-tight text-white drop-shadow-xl sm:text-5xl md:text-6xl lg:text-7xl">
            Timeless Elegance in
            <span className="mt-2 block animate-shimmer bg-[length:200%_auto] text-gradient-silk">
              Every Thread
            </span>
          </h1>
        </motion.div>
        <motion.p
          className="mx-auto mb-10 max-w-3xl leading-relaxed text-white/90 drop-shadow-lg md:text-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Discover the finest collection of silk sarees, cotton sarees, and
          dress materials crafted with tradition and love.
        </motion.p>
      </div>
    </section>
  );
};

export default Hero;