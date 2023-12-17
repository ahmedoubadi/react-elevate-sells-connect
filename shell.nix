with import (fetchTarball https://github.com/NixOS/nixpkgs/archive/22.11.tar.gz) { };

stdenv.mkDerivation {
  name = "react-elevate-sells-connect";

  buildInputs = with pkgs; [
    git
    nodejs
    yarn
  ];
}
