# Connecting to Your Server

Now that you have a server, let's connect to it. This is how you'll send commands to install and configure SoilFER-LIMS.

---

## What You Need

- Your server's **IP address** (from your hosting provider)
- Your **username** (usually `root` for new servers)
- Your **password** (emailed by your provider) or **SSH key**

---

## Connecting from Mac or Linux

Open the **Terminal** app and type:

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with your actual IP address. For example:

```bash
ssh root@46.19.33.37
```

**The first time you connect**, you'll see a message like:

```
The authenticity of host '46.19.33.37' can't be established.
ECDSA key fingerprint is SHA256:abc123...
Are you sure you want to continue connecting (yes/no)?
```

Type `yes` and press Enter. This is normal — your computer is confirming it's talking to the right server.

Then enter your password when prompted. **Nothing will appear on screen as you type** — this is a security feature, not a bug. Just type the password and press Enter.

If it worked, you'll see a prompt like:

```
root@soilfer-lims:~#
```

🎉 **You're connected!** You can now type commands on your server.

---

## Connecting from Windows

### Option A: Using Windows Terminal or Command Prompt

Windows 10 and 11 have SSH built in. Open **Command Prompt** or **PowerShell** and type:

```
ssh root@YOUR_SERVER_IP
```

This works exactly the same as on Mac/Linux (see above).

### Option B: Using PuTTY

1. Download PuTTY from [putty.org](https://www.putty.org/) and install it
2. Open PuTTY
3. In the **Host Name** field, type your server's IP address
4. Make sure **Port** is `22` and **Connection type** is `SSH`
5. Click **Open**
6. When prompted, click **Accept** (to trust the server's key)
7. Type `root` as the username
8. Type your password (nothing will appear — just type and press Enter)

---

## First Time on the Server? Create a Regular User (Optional but Recommended)

For security, it's better to create a regular user account instead of always using `root`. This is optional — if you're comfortable using `root`, you can skip this.

```bash
# Create a new user (replace 'soilfer' with any username you like)
adduser soilfer

# Give them sudo (administrator) privileges
usermod -aG sudo soilfer
```

From now on, you can log in as `soilfer` instead of `root`:

```bash
ssh soilfer@YOUR_SERVER_IP
```

And prefix administrative commands with `sudo`:

```bash
sudo apt update    # instead of just: apt update
```

> 📖 **Want to learn more about Linux?** These beginner guides are excellent:
> - [Linux command line for beginners (Ubuntu)](https://ubuntu.com/tutorials/command-line-for-beginners)
> - [Basic Linux commands (DigitalOcean)](https://www.digitalocean.com/community/tutorials/linux-commands)

---

## Testing Your Connection

Try this command to make sure everything works:

```bash
echo "Hello from my server!"
```

If you see `Hello from my server!` printed back, you're ready to proceed to the next step!
