function Header() {
  return (
    <header className="text-center text-gray-800 mb-8 sm:mb-10">
      <h1 className="tracking-tight">
        <img
          src={import.meta.env.BASE_URL + 'assets/presub-logo.png'}
          alt="PreSub logo"
          className="mx-auto h-10 sm:h-12 md:h-14 lg:h-16 w-auto"
          loading="eager"
          decoding="async"
        />
      </h1>
      <p className="text-base sm:text-lg mt-2 text-gray-600 max-w-2xl mx-auto px-2">
        Scan your documents locally for anonymity before submission.
      </p>
    </header>
  );
}

export default Header;
