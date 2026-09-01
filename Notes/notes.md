# Environment

- OS: Windows
- Terminal: PowerShell / IntelliJ IDEA Terminal
- Container engine: Podman
- Podman Machine: `podman-machine-default`
- VM type: WSL
- Podman version: `6.0.2`
- Rootless Podman: enabled
- Rootful: `false`
- Network backend: `netavark`
- DNS: `aardvark-dns`
- Rootless networking: `pasta`
- cgroup: v2
- cgroup manager: systemd

---

# 1. Podman Machine

I created and started the Podman machine:

```text
podman-machine-default
````

I checked its status using:

```powershell
podman machine list
```

The machine is running with:

* 4 CPUs
* 2 GB memory
* 100 GB disk
* WSL VM
* Rootless mode

I also inspected it using:

```powershell
podman machine inspect
```

---

# 2. Podman Information

I checked the Podman configuration using:

```powershell
podman info
```

Important settings:

```text
cgroupManager: systemd
cgroupVersion: v2
networkBackend: netavark
rootlessNetworkCmd: pasta
rootless: true
runRoot: /run/user/1000/containers
remoteSocket: unix:///run/user/1000/podman/podman.sock
```

This confirmed that Podman is running through the WSL-based Podman machine.

---

# 3. Accessing the Podman Machine

I used:

```powershell
podman machine ssh
```

to enter the Linux environment inside the Podman machine.

The prompt looks like:

```text
[user@DESKTOP-PL1V7US ~]$
```

I can leave the machine using:

```bash
exit
```

---

# 4. Checking the Runtime Directory

Inside the Podman machine, I checked:

```bash
echo $XDG_RUNTIME_DIR
```

The result was:

```text
/run/user/1000
```

I also checked:

```bash
ls -ld /run/user/1000
```

The directory exists and belongs to my user.

---

# 5. Checking systemd

I checked the systemd user session using:

```bash
systemctl --user status
```

The result showed:

```text
State: running
Failed: 0 units
```

I also confirmed that the DBus user service is running:

```text
dbus-broker.service
```

Therefore, I did not need to use:

```bash
loginctl enable-linger 1000
```

because the systemd user session was already working.

---

# 6. EventHub Network

My EventHub project uses the Podman network:

```text
eventhub-net
```

I checked whether the network exists using:

```bash
podman network exists eventhub-net
```

The network already exists.

---

# 7. Testing Podman Containers

Inside the Podman machine, I tested a basic container:

```bash
podman run --rm alpine echo "container works"
```

The result was:

```text
container works
```

This confirmed that Podman can successfully run containers.

---

# 8. Testing EventHub Networking

I tested the EventHub network using:

```bash
podman run --rm --network eventhub-net alpine echo "network works"
```

The result was:

```text
network works
```

This confirmed that:

* `eventhub-net` works
* Podman networking works
* netavark works
* rootless networking works

---

# EventHub Containers

## 9. Infrastructure Containers

My project uses separate containers for the infrastructure services:

```text
eventhub-postgres
eventhub-mongo
eventhub-mysql
eventhub-redis
eventhub-rabbitmq
```

Images:

```text
postgres:16
mongo:7
mysql:8
redis:7
rabbitmq:3
```

These containers use:

```text
eventhub-net
```

---

## 10. Application Containers

I also use a separate container for each application service:

```text
eventhub-ai
eventhub-auth
eventhub-catalog
eventhub-booking
eventhub-notification
eventhub-analytics
eventhub-frontend
```

The project intentionally uses multiple containers because it is based on a microservices architecture.

---

# run-all.sh

## 11. Main Startup Script

My main startup script is:

```text
infra/scripts/run-all.sh
```

I run it using:

```powershell
bash infra/scripts/run-all.sh
```

The script:

1. Checks `eventhub-net`
2. Starts PostgreSQL
3. Starts MongoDB
4. Starts MySQL
5. Starts Redis
6. Starts RabbitMQ
7. Waits for the infrastructure containers
8. Builds the service images
9. Starts the AI service
10. Starts the Auth service
11. Starts the Catalog service
12. Starts the Booking service
13. Starts the Notification Worker
14. Starts the Analytics service
15. Starts the Frontend
16. Runs the analytics job

---

# 12. Container Reuse Logic

My `run-all.sh` script contains:

```bash
start_existing_or_run()
```

The function checks whether a container already exists.

If it exists and is running:

```text
The container is already running.
```

If it exists but is stopped:

```text
Starting existing container
```

If it does not exist:

```text
Creating container
```

This means the script is designed to reuse existing containers instead of creating duplicates.

---

# Problem Encountered

## 13. First Startup Attempt

I ran:

```powershell
bash infra/scripts/run-all.sh
```

Podman displayed warnings about systemd:

```text
The cgroupv2 manager is set to systemd but there is no systemd user session available
```

and:

```text
Falling back to --cgroup-manager=cgroupfs
```

At first, I thought systemd was the main problem.

---

# 14. Actual Error

The important error was:

```text
failed to move the rootless netns pasta process to the systemd user.slice:
dbus: couldn't determine address of session bus
```

Then I got:

```text
netavark: failed to create aardvark-dns directory
/run/user/1000/containers/networks/aardvark-dns:
No such file or directory
```

The error happened while starting:

```text
eventhub-postgres
```

The script showed:

```text
Starting existing container: eventhub-postgres
```

---

# Troubleshooting

## 15. I Checked the Podman Machine

I ran:

```powershell
podman machine list
```

The machine was:

```text
Currently running
```

Therefore, the Podman machine itself was not stopped or unavailable.

---

## 16. I Checked systemd

Inside the machine, I ran:

```bash
systemctl --user status
```

I got:

```text
State: running
Failed: 0 units
```

DBus was also running.

Therefore, systemd and DBus are available inside the Podman machine.

---

## 17. I Checked `/run/user/1000`

I ran:

```bash
echo $XDG_RUNTIME_DIR
```

and got:

```text
/run/user/1000
```

I also confirmed that the directory exists.

Therefore, the runtime directory itself is not missing.

---

## 18. I Tested Containers Directly

I ran:

```bash
podman run --rm alpine echo "container works"
```

and it worked.

I then tested networking:

```bash
podman run --rm --network eventhub-net alpine echo "network works"
```

and it also worked.

This showed that Podman and basic networking work correctly when tested directly inside the Podman machine.

---

# Current Container State

## 19. Checking Existing Containers

I used:

```powershell
podman ps -a
```

At one point I had:

```text
eventhub-postgres
eventhub-mongo
```

For example:

```text
eventhub-postgres   postgres:16   Up
eventhub-mongo      mongo:7       Created
```

I should remember that my project is supposed to contain multiple containers, one for each infrastructure/service component.

---

# Important Notes

## 20. I Should NOT Do These

I should NOT run:

```powershell
podman system reset
```

because I do not want to unnecessarily delete my Podman data and volumes.

I should NOT delete the persistent database volumes unless I intentionally want to reset the databases.

I should NOT recreate the entire Podman machine unless it is proven necessary.

I should NOT randomly modify `run-all.sh`.

I should also not delete all EventHub containers just because multiple containers exist. Multiple containers are expected in this project.

---

# 21. Persistent Volumes

The infrastructure containers use persistent volumes such as:

```text
eventhub-postgres-data
eventhub-mongo-data
eventhub-mysql-data
eventhub-redis-data
eventhub-rabbitmq-data
```

These volumes should be preserved during troubleshooting.

If I recreate a container, I should keep its associated volume.

---

# 22. Useful Commands

### Check Podman machine

```powershell
podman machine list
```

### Inspect Podman machine

```powershell
podman machine inspect
```

### Check Podman configuration

```powershell
podman info
```

### Enter Podman machine

```powershell
podman machine ssh
```

### Exit Podman machine

```bash
exit
```

### Check all containers

```powershell
podman ps -a
```

### Check running containers

```powershell
podman ps
```

### Check networks

```powershell
podman network ls
```

### Inspect EventHub network

```powershell
podman network inspect eventhub-net
```

### Start EventHub

```powershell
bash infra/scripts/run-all.sh
```

---

# Current Status

## Working

* Podman installation
* Podman Machine
* WSL2
* Rootless Podman
* systemd user session
* DBus
* netavark
* aardvark-dns
* pasta
* `eventhub-net`
* Basic container execution
* Basic container networking


