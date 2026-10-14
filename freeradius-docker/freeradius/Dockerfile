FROM freeradius/freeradius-server:latest

# Copia configurações personalizadas
COPY clients.conf /etc/freeradius/clients.conf

# Copia a configuração SQL personalizada
COPY mods-available/sql /etc/freeradius/mods-available/sql

# Habilita o módulo SQL e o listener de CoA
RUN ln -sf ../mods-available/sql /etc/freeradius/mods-enabled/sql && \
    ln -sf /etc/freeradius/sites-available/coa /etc/freeradius/sites-enabled/coa

# Configura permissões
RUN chown -R root:freerad /etc/freeradius && \
    chmod 640 /etc/freeradius/clients.conf \
              /etc/freeradius/mods-config/files/authorize \
              /etc/freeradius/mods-available/sql

# Portas RADIUS
EXPOSE 1812/udp 1813/udp 3799/udp

# Executa em modo de depuração
CMD ["freeradius", "-X"]