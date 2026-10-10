FROM freeradius/freeradius-server:latest

# Copia configurações personalizadas de clientes e usuários
COPY clients.conf /etc/freeradius/clients.conf
COPY users /etc/freeradius/mods-config/files/authorize

# Habilita o listener de CoA / Disconnect (porta UDP 3799)
RUN ln -sf /etc/freeradius/sites-available/coa /etc/freeradius/sites-enabled/coa

# Garante permissões estritas exigidas pelo FreeRADIUS
RUN chown -R root:freerad /etc/freeradius && \
    chmod 640 /etc/freeradius/clients.conf /etc/freeradius/mods-config/files/authorize

# Portas padrão RADIUS:
# 1812/udp: Autenticação (Access-Request)
# 1813/udp: Contabilização (Accounting-Start/Stop/Interim)
# 3799/udp: CoA & Disconnect
EXPOSE 1812/udp 1813/udp 3799/udp

# Executa em modo de depuração com saída detalhada de pacotes
CMD ["freeradius", "-X"]
