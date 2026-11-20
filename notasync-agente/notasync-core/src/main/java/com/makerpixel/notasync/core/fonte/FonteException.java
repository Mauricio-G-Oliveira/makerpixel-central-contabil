package com.makerpixel.notasync.core.fonte;

/**
 * Exceção lançada em caso de falha de comunicação, autenticação ou parsing na fonte fiscal.
 */
public class FonteException extends Exception {

    private final String fonteId;
    private final int cStat;

    public FonteException(String fonteId, String message) {
        super(message);
        this.fonteId = fonteId;
        this.cStat = 0;
    }

    public FonteException(String fonteId, int cStat, String message) {
        super(message);
        this.fonteId = fonteId;
        this.cStat = cStat;
    }

    public FonteException(String fonteId, String message, Throwable cause) {
        super(message, cause);
        this.fonteId = fonteId;
        this.cStat = 0;
    }

    public String getFonteId() {
        return fonteId;
    }

    public int getCStat() {
        return cStat;
    }
}
