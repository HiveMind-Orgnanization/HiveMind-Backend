import React from 'react';

const UserTestimonials: React.FC = () => {
  return (
    <section className="bg-dark text-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-5xl font-bold mb-16 text-center drop-shadow-lg">User Testimonials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <p className="text-lg">"This protocol has revolutionized my approach to DeFi. The user experience is seamless and secure."</p>
            <p className="mt-4 font-bold">- User A</p>
          </div>
          <div className="bg-dark p-10 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
            <p className="text-lg">"I appreciate the transparency and the innovative features offered. Highly recommend!"</p>
            <p className="mt-4 font-bold">- User B</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UserTestimonials;
