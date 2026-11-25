# Spotify Activity Card

A small Vercel serverless function that renders a Spotify listening card as SVG using your Discord presence from [Lanyard](https://github.com/Phineas/lanyard).

## 1. Requirements

- Your Discord account must be in the [Lanyard Discord server](https://discord.gg/lanyard).
- Spotify must be connected to Discord.
- Discord Activity Status / Share Spotify activity must be enabled.
- Deploy this project to Vercel.

No Spotify API key, OAuth app, database, or paid service is required.

## 2. Deploy

1. Create a new GitHub repository and upload the contents of this folder.
2. Import that repository into Vercel.
3. Deploy with the default settings.
4. Your card endpoint will be:

   `https://YOUR-PROJECT.vercel.app/api/spotify`

The Discord user ID is currently set to `794143054117601310` in `api/spotify.js`. If you want to use another account, set the `DISCORD_USER_ID` environment variable in Vercel.

## 3. Add it to your GitHub README

```html
<div align="center">
  <a href="https://discord.com/users/794143054117601310">
    <img src="https://lanyard.cnrad.dev/api/794143054117601310?hideTimestamp=true&idleMessage=I've%20got%20nothing%20to%20do!!" height="150" alt="Discord presence">
  </a>
  <a href="https://open.spotify.com/user/6kko55cnc7uj7uw017830ddjr">
    <img src="https://YOUR-PROJECT.vercel.app/api/spotify" height="150" alt="Spotify listening activity">
  </a>
</div>
```

Replace `YOUR-PROJECT` with your Vercel deployment name.

## Notes

- The Spotify card links to the currently playing Spotify track.
- When you're not listening, it displays an offline state.
- The progress bar is calculated when the image is requested. GitHub may cache remote images, so updates may not appear instantly.
- This project displays activity only. It does not play or stream music.
