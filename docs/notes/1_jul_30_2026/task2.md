# made sudo /usr/bin/wg-quick up anything

# made sudo /usr/bin/wg-quick down anything

## work without root password

1. ran sudo visudo
2. added these line in file

```bash
kalimain ALL=(root) NOPASSWD: /usr/bin/wg-quick up *
kalimain ALL=(root) NOPASSWD: /usr/bin/wg-quick down *
```

3. forked wireguard tools and create two new functions by extending ready made ones to run working command
