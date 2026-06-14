FROM node:20-alpine


WORKDIR /workspace

COPY package*.json ./
RUN npm install

COPY . .

# Run punctuation linting check
RUN sh lint_no_ai_punctuation.sh

# Environment flag for production compilation
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
