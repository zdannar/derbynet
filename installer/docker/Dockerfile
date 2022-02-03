FROM debian:stable-slim
RUN apt-get update && \
    apt-get install -y apt-transport-https curl nginx sed vim less && \
    curl https://jeffpiazza.org/derbynet/debian/jeffpiazza_derbynet.gpg -o /usr/share/keyrings/derbynet-archive-keyring.gpg && \
    echo "deb [arch=all signed-by=/usr/share/keyrings/derbynet-archive-keyring.gpg] " \
    " https://jeffpiazza.org/derbynet/debian stable main" >> /etc/apt/sources.list.d/derbynet.list && \
    apt-get update
RUN apt-get install -y derbynet-server || echo "Masking config error"
RUN sed -i -e 's/unix:.*/unix:\/var\/run\/php\/php7.4-fpm.sock;/' /etc/nginx/derbynet/location.snippet

EXPOSE 80
CMD ["/bin/bash", "-c", "service php7.4-fpm start && /usr/sbin/nginx -g 'daemon off;'"]
