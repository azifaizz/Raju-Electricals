import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import OurStory from "@/components/OurStory";
import Collections from "@/components/Collections";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";

const Index = ({ onLoginClick }: { onLoginClick: () => void }) => {
  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <Header onLoginClick={onLoginClick} />
      <main>
        <Hero />
        <About />
        <OurStory />
        <Collections />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;