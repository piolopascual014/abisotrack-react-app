package ph.edu.udm.abisotrack.gateway;

final class SmsJob {
    final String id;
    final String phone;
    final String message;
    final int attempt;

    SmsJob(String id, String phone, String message, int attempt) {
        this.id = id;
        this.phone = phone;
        this.message = message;
        this.attempt = attempt;
    }
}

