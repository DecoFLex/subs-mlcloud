# Gunakan Node.js versi LTS
FROM node:18

# Set direktori kerja
WORKDIR /usr/src/app

# Salin file package.json dan package-lock.json
COPY package*.json ./

# Install dependensi
RUN npm install

# Salin seluruh isi folder ke dalam container
COPY . .

# Ekspose port yang akan digunakan
EXPOSE 8080

# Jalankan aplikasi menggunakan nodemon
CMD ["npm", "start"]
