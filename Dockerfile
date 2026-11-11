# Node 22 is required: the app uses the built-in node:sqlite module, which does not
# exist in older versions. There are no npm packages to install.
FROM node:22-alpine

WORKDIR /app
COPY . .

# The database lives on a mounted volume, never inside the image — a container is
# replaced on every deploy and would take the data with it.
ENV DATA_DIR=/data
ENV PORT=4000
ENV TZ=Asia/Kolkata
VOLUME /data

EXPOSE 4000
CMD ["node", "server.js"]
