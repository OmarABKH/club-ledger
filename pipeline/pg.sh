# pg.sh file pattern -> page number of the first line matching pattern
n=$(grep -n -i -m1 "$2" "$1" | cut -d: -f1); [ -n "$n" ] && head -"$n" "$1" | grep "=== PAGE" | tail -1 | grep -o '[0-9]*'
