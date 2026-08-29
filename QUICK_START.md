# ⚡ Quick Start - Deploy OptiNetX in 5 Minutes

## 🎯 Easiest Method: Vercel (Recommended)

### Step 1: Sign Up for Vercel (30 seconds)
1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel

### Step 2: Create GitHub Repository (2 minutes)
1. Go to **[github.com](https://github.com)**
2. Click **"+"** → **"New repository"**
3. Name it: `optinetx`
4. Make it **Public**
5. Click **"Create repository"**

### Step 3: Upload Your Code (1 minute)

Open Command Prompt in your project folder:
```bash
cd "C:\Users\Visitor\Desktop\ROUTER MAPPING PRJ\project"

git init
git add .
git commit -m "OptiNetX Network Planner"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/optinetx.git
git push -u origin main
```

*(Replace YOUR_USERNAME with your GitHub username)*

### Step 4: Deploy on Vercel (1 minute)
1. Go back to **[vercel.com](https://vercel.com)**
2. Click **"Add New..." → "Project"**
3. Click **"Import"** next to your `optinetx` repository
4. Click **"Deploy"**
5. ✅ **Done!** Copy your URL!

**Your Live URL:** `https://optinetx.vercel.app`

---

## 🚀 Alternative: Netlify Drop (Even Easier - No Code!)

### Drag & Drop Method (1 minute)

1. Go to **[netlify.com](https://app.netlify.com/drop)**
2. Sign up with GitHub (or email)
3. **Drag your entire project folder** to the drop zone
4. ✅ **Done!** Get your URL!

**Your Live URL:** `https://random-name-123.netlify.app`

*(You can change the name in settings)*

---

## 📱 Share Your App

Once deployed, anyone can access:
- **Landing Page:** `https://your-app.vercel.app/`
- **Main App:** `https://your-app.vercel.app/app`

---

## 🎨 Want a Custom Domain?

### Get a free subdomain:
- Vercel: Your app automatically gets `your-name.vercel.app`
- Netlify: Your app automatically gets `your-name.netlify.app`

### Use your own domain (like optinetx.com):
1. Buy a domain from Namecheap, GoDaddy, or Google Domains
2. In Vercel/Netlify settings, click "Add custom domain"
3. Follow DNS configuration steps
4. ✅ Your app is now at `yourdomain.com`

---

## 🧪 Test Locally First

Before deploying, test on your computer:

```bash
# Install Node.js from nodejs.org if you don't have it

# Then run:
cd "C:\Users\Visitor\Desktop\ROUTER MAPPING PRJ\project"
npm install
npm start
```

Visit: `http://localhost:8000/landing.html`

---

## 🆘 Troubleshooting

### Can't push to GitHub?
```bash
# If you get authentication error, use Personal Access Token:
# 1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token
# 2. Copy the token
# 3. When Git asks for password, paste the token
```

### Deployment failed?
- Check if all files are in the correct location
- Ensure `landing.html` and `index.html` are in root folder
- Check deployment logs in Vercel/Netlify dashboard

### Map not loading after deployment?
- Your app needs internet connection to load map tiles
- Check browser console (F12) for errors
- Ensure all CDN links are working

---

## ✅ Deployment Checklist

- [ ] All files are in one folder
- [ ] `landing.html` is the entry point
- [ ] Tested locally and everything works
- [ ] Created GitHub account
- [ ] Created Vercel/Netlify account
- [ ] Uploaded code to GitHub
- [ ] Deployed to Vercel/Netlify
- [ ] Tested live URL
- [ ] Shared URL with others!

---

## 🎉 You're Live!

Your OptiNetX Network Planner is now accessible to anyone with the URL!

**Next Steps:**
- Share the URL with your team
- Set up a custom domain
- Add analytics to track visitors
- Keep improving the app

---

**Made by RITWIK KUMAR** 🚀

*Need help? Read the full DEPLOYMENT_GUIDE.md*
