## Videos and metadata can be downloaded using the command: 
```
wget -r -l1 -A "*.mp4" -A "*.json" -nd -P videos http://130.245.136.73/mnt2/video/m1.html
```

## Note: Port 25, the standard SMTP port, is blocked by default. Please execute the following commands on your VMs that need to send email, and our grading instance will act as a relay:
```
ip6tables -I OUTPUT -p tcp -m tcp --dport 25 -j DROP
iptables -t nat -I OUTPUT -o ens3 -p tcp -m tcp --dport 25 -j DNAT --to-destination 130.245.136.123:11587
```
## Note that iptables commands are not automatically saved on server restart.

## After getting the videos and metadata, run the shell scripts which process the videos and thumbnails.
