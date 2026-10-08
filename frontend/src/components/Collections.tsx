import AnimatedSection from "./AnimatedSection";
import silkSareesImage from "@/assets/silk-sarees.jpg";
import cottonSareesImage from "@/assets/cotton-sarees.jpg";
import dressMaterialsImage from "@/assets/dress-materials.jpg";

const Collections = () => {
  const collections = [
    {
      title: "Silk Sarees",
      image: silkSareesImage,
      description: "Exquisite silk sarees with intricate zari work, perfect for special occasions.",
    },
    {
      title: "Cotton Sarees",
      image: cottonSareesImage,
      description: "Comfortable and elegant cotton sarees for everyday wear, featuring beautiful prints.",
    },
    {
      title: "Dress Materials",
      image: dressMaterialsImage,
      description: "Premium quality dress materials in vibrant colors and patterns for your dream outfit.",
    },
  ];

  return (
    <AnimatedSection id="collections">
      <div className="container mx-auto px-4">
        <div className="animated-border-advanced p-8 md:p-12 bg-white/50 backdrop-blur-xl rounded-2xl shadow-elegant">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-gray-900">
              Our <span className="text-gradient-silk">Collections</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Explore our carefully curated selection of traditional and
              contemporary textiles.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collections.map((collection) => (
              // --- THIS IS THE MODIFIED PART ---
              <div
                key={collection.title}
                className="bg-white/60 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden group transition-shadow duration-300 hover:shadow-dramatic border border-white/50"
              >
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={collection.image}
                    alt={collection.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-in-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <h3 className="absolute bottom-4 left-4 text-3xl font-serif font-bold text-white drop-shadow-lg">
                    {collection.title}
                  </h3>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 mb-4">{collection.description}</p>
                  <a
                    href="#contact"
                    className="font-bold text-gradient-silk hover:opacity-80 transition-opacity"
                  >
                    Enquire Now →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};
export default Collections;