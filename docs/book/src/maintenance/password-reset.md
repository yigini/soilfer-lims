# Resetting the Admin Password

If you forget the admin password, you can reset it from the server command line.

---

## Steps

### 1. Connect to Your Server

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Open a Shell Inside the Container

```bash
docker exec -it soilfer-lims sh
```

### 3. Reset the Password

```bash
cd /app/server
node -e "
const {PrismaClient}=require('./prisma_client');
const bcrypt=require('bcryptjs');
const crypto=require('crypto');
const p=new PrismaClient();
(async()=>{
  const tempPass = crypto.randomBytes(6).toString('base64url');
  const hash=await bcrypt.hash(tempPass,10);
  await p.user.updateMany({
    where:{username:'admin'},
    data:{password:hash, mustChangePassword:true}
  });
  console.log('Password reset successfully.');
  console.log('Temporary password:', tempPass);
  process.exit(0);
})()
"
```

### 4. Exit the Container

```bash
exit
```

### 5. Log In

Go to your LIMS URL and log in with:
- **Username:** `admin`
- **Password:** `<temporary-password>` (from step 3 above)

You'll be prompted to set a new institutional password immediately.

---

## Resetting Any User's Password

If a staff member forgets their password, a Lab Manager or Super Admin can reset it from the LIMS interface:

1. Go to **Settings → Users**
2. Find the user
3. Click **"Reset Password"**
4. A temporary password will be generated
5. Share it with the user — they'll change it on next login
