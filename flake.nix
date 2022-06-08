{
  description = "Basic typescript environment. Run `setup`.";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { system = system; };
        setupScript = pkgs.writeScriptBin "setup" ''
          #!/usr/bin/env bash

          yarn init

          # Install dependencies
          yarn add --dev typescript jest @babel/preset-typescript @types/jest babel-jest @babel/core @babel/preset-env

          mkdir src || true

          cat > src/sum.ts <<EOF
          export default function sum(a: number, b: number) {
            return a + b;
          }
          EOF

          cat > src/sum.test.ts <<EOF
          import sum from './sum'

          test('adds 1 + 2 to equal 3', () => {
            expect(sum(1, 2)).toBe(3);
          });
          EOF

          cat > babel.config.js <<EOF
          module.exports = {
            presets: [
              ['@babel/preset-env', {targets: {node: 'current'}}],
              '@babel/preset-typescript',
            ],
          };
          EOF

          cat > .gitignore <<EOF
          node_modules
          EOF

          yarn tsc --init
        '';
      in
      {
        packages.hello = pkgs.hello;
        defaultPackage = self.packages.${system}.hello;
        devShell = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs yarn setupScript deno];
        };
      });
}
