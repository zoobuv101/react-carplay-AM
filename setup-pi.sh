#!/bin/bash

# location of the built AppImage on the user’s Desktop
path="$HOME/Desktop/Carplay.AppImage"

# make sure the Desktop folder exists
mkdir -p "$HOME/Desktop"


#create udev rule thats specific to carlinkit device
echo "Creating udev rules"

FILE=/etc/udev/rules.d/52-nodecarplay.rules
echo "SUBSYSTEM==\"usb\", ATTR{idVendor}==\"1314\", ATTR{idProduct}==\"152*\", MODE=\"0660\", GROUP=\"plugdev\"" | sudo tee $FILE

if [[ $? -eq 0 ]]; then
	echo -e Permissions created'\n'
    else
	echo -e Unable to create permissions'\n'
fi
echo "checking for fuse packages"

REQUIRED_PKG="fuse"
PKG_OK=$(dpkg-query -W --showformat='${Status}\n' $REQUIRED_PKG|grep "install ok installed")
echo Checking for $REQUIRED_PKG: $PKG_OK
if [ "" = "$PKG_OK" ]; then
  echo "No $REQUIRED_PKG. Setting up $REQUIRED_PKG."
  sudo apt-get --yes install $REQUIRED_PKG
fi

REQUIRED_PKG="libfuse2"
PKG_OK=$(dpkg-query -W --showformat='${Status}\n' $REQUIRED_PKG|grep "install ok installed")
echo Checking for $REQUIRED_PKG: $PKG_OK
if [ "" = "$PKG_OK" ]; then
  echo "No $REQUIRED_PKG. Setting up $REQUIRED_PKG."
  sudo apt-get --yes install $REQUIRED_PKG
fi

echo "Building local AppImage from source…"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm not found; installing via NodeSource..."
  # add NodeSource v18.x
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
  sudo apt-get update
  sudo apt-get install -y nodejs build-essential libgtk-3-dev
fi
# 1) Enter your cloned React-CarPlay directory
cd "/home/$USER/react-carplay-AM"

# 2) Install Node deps (including native modules)
npm install

# 3) Build the AppImage for ARM (arm64 on Pi 5)
npm run build:armLinux

# 4) Copy the generated AppImage to the desktop
echo "Locating AppImage in dist/…"
APPIMAGE=$(find dist -type f -name "*.AppImage" | head -n1)
if [ -z "$APPIMAGE" ]; then
  echo "No AppImage found under dist/, aborting."
  exit 1
fi
mkdir -p "/home/$USER/Desktop"
echo "Copying $APPIMAGE → ~/Desktop/Carplay.AppImage"
cp "$APPIMAGE" "/home/$USER/Desktop/Carplay.AppImage"
chmod +x "/home/$USER/Desktop/Carplay.AppImage"
echo "AppImage on Desktop."

echo "Local AppImage built and placed on desktop."

echo "Adding CarPlay to LX autostart…"
AUTOSTART_FILE="$HOME/.config/lxsession/LXDE-pi/autostart"
mkdir -p "$(dirname "$AUTOSTART_FILE")"
# Ensure we only add it once
grep -qxF "@/home/$USER/Desktop/Carplay.AppImage" "$AUTOSTART_FILE" 2>/dev/null \
  || echo "@/home/$USER/Desktop/Carplay.AppImage" >> "$AUTOSTART_FILE"
chown -R "$USER:$USER" "$(dirname "$AUTOSTART_FILE")"
echo " Autostart entry created in $AUTOSTART_FILE."

echo "All Done"
