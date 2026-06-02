# Peter-Daily

Mobile-first daily stat and streak tracker for calories, flash cards, miles, and weekly weight.

## Local Preview

```powershell
npm install
npm run build
npm run serve
```

The static preview server uses:

```text
http://127.0.0.1:5180/
```

## AWS Setup

This project uses the local AWS profile `myprofile` in `us-west-2`.

Configure or refresh the AWS profile before deploying the Amplify sandbox:

```powershell
aws configure --profile myprofile
```

Then deploy the backend and write `amplify_outputs.json`:

```powershell
npm run sandbox -- --once
```

After `amplify_outputs.json` exists, the app automatically enables Cognito email/password login and uses Amplify Data for cloud entries.

## Useful Scripts

```powershell
npm run build
npm run serve
npm run sandbox
```
